"use client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useState } from "react";
import { FileUp, Link2, Shield, Users, Clock, Info } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

const dropFormSchema = z
  .object({
    name: z.string().min(1, "Drop name is required").max(100),
    dropType: z.enum(["file", "url"]),
    maskedUrl: z.string().optional(),
    recipients: z.string().min(1, "At least one recipient email is required"),
    expiresIn: z.enum(["1h", "24h", "7d", "30d", "custom"]),
    customExpiry: z.string().optional(),
    oneTimeAccess: z.boolean().default(false),
    sendNotifications: z.boolean().default(true),
    description: z.string().max(500).optional(),
  })
  .refine(
    (data) => {
      if (data.dropType === "url" && (!data.maskedUrl || data.maskedUrl.trim() === "")) {
        return false;
      }
      if (data.dropType === "url" && data.maskedUrl) {
        try {
          new URL(data.maskedUrl);
          return true;
        } catch {
          return false;
        }
      }
      return true;
    },
    {
      message: "Please enter a valid URL",
      path: ["maskedUrl"],
    }
  );

type DropFormData = z.infer<typeof dropFormSchema>;

export function DropForm() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
    reset,
  } = useForm<DropFormData>({
    resolver: zodResolver(dropFormSchema),
    defaultValues: {
      name: "",
      dropType: "url",
      expiresIn: "24h",
      oneTimeAccess: false,
      sendNotifications: true,
      description: "",
      recipients: "",
      maskedUrl: "",
    },
  });

  const dropType = watch("dropType");
  const expiresIn = watch("expiresIn");

  const calculateExpiryDate = (expiresIn: string, customExpiry?: string) => {
    if (expiresIn === "custom" && customExpiry) {
      return new Date(customExpiry).toISOString();
    }
    const now = new Date();
    switch (expiresIn) {
      case "1h":
        return new Date(now.getTime() + 60 * 60 * 1000).toISOString();
      case "24h":
        return new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
      case "7d":
        return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
      case "30d":
        return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
      default:
        return new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
    }
  };

  // Fixed function signature, file naming, and path logic
  const handleFileUpload = async (file: File, dropId: string): Promise<string> => {
    const fileExt = file.name.split(".").pop() ?? "bin";
    const randomPortion = Math.random().toString().slice(2);
    const fileName = `${dropId}/${randomPortion}.${fileExt}`;
    const filePath = `drops/${fileName}`;
    const { error: uploadError } = await supabase.storage
      .from("drops")
      .upload(filePath, file);

    if (uploadError) {
      throw uploadError;
    }
    return filePath;
  };

  const onSubmit = async (data: DropFormData) => {
    setIsSubmitting(true);
    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user) {
        throw new Error("Please sign in to create a drop");
      }

      const dropPayload = {
        owner_id: user.id,
        name: data.name,
        drop_type: data.dropType,
        masked_url: data.dropType === "url" ? data.maskedUrl : null,
        expires_at: calculateExpiryDate(data.expiresIn, data.customExpiry),
        description: data.description || null,
        one_time_access: data.oneTimeAccess,
      };

      const { data: insertedDrop, error: dropError } = await supabase
        .from("drops")
        .insert(dropPayload)
        .select()
        .single();

      if (dropError || !insertedDrop) {
        throw dropError ?? new Error("Drop insert failed");
      }

      if (data.dropType === "file" && uploadedFile) {
        const fullPath = await handleFileUpload(uploadedFile, insertedDrop.id);
        const { error: updateError } = await supabase
          .from("drops")
          .update({ file_path: fullPath })
          .eq("id", insertedDrop.id);

        if (updateError) throw updateError;
      }

      const recipientEmails = data.recipients
        .split(/[,\n]/)
        .map((email) => email.trim())
        .filter((email) => email.length > 0);

      const recipientsPayload = recipientEmails.map((email) => ({
        drop_id: insertedDrop.id,
        email,
      }));

      const { error: recipientsError } = await supabase
        .from("drop_recipients")
        .insert(recipientsPayload);

      if (recipientsError) throw recipientsError;

      if (data.sendNotifications) {
        // Add email notification logic here in production
        console.log("Would send notifications to:", recipientEmails);
      }

      toast.success("Drop created successfully!");
      reset();
      router.push(`/drops/${insertedDrop.id}`);
    } catch (err: any) {
      console.error("Error creating drop:", err);
      toast.error(err.message || "Failed to create drop");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 100 * 1024 * 1024) {
      toast.error("File size must be less than 100MB");
      return;
    }
    setUploadedFile(file);
  };

  return (
    <div className="min-h-screen bg-background pt-20 pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Shield className="w-8 h-8 text-purple-600" />
            Create Secure Drop
          </h1>
          <p className="mt-2 text-lg text-gray-600">
            Share files and links securely with time-based access control
          </p>
        </div>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column */}
            <div className="space-y-6">
              {/* Drop Details Card */}
              <Card className="shadow-sm">
                <CardHeader className="pb-4">
                  <CardTitle className="text-xl flex items-center gap-2">
                    <Info className="w-5 h-5" />
                    Drop Information
                  </CardTitle>
                  <CardDescription>Basic details about your secure drop</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="name" className="text-sm font-medium mb-1.5 block">
                      Drop Name <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="name"
                      {...register("name")}
                      placeholder="e.g., Q4 Financial Report"
                      className={errors.name ? "border-red-500" : ""}
                    />
                    {errors.name && (
                      <p className="text-sm text-red-500 mt-1">{errors.name.message}</p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="description" className="text-sm font-medium mb-1.5 block">
                      Description
                    </Label>
                    <Textarea
                      id="description"
                      {...register("description")}
                      placeholder="Optional: Add context for recipients..."
                      rows={2}
                      className="resize-none"
                    />
                  </div>

                  <div>
                    <Label className="text-sm font-medium mb-3 block">Share Type</Label>
                    <RadioGroup
                      value={dropType}
                      onValueChange={(value) => setValue("dropType", value as "file" | "url")}
                      className="space-y-2"
                    >
                      <div className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-gray-50 cursor-pointer">
                        <RadioGroupItem value="url" id="url" />
                        <Label htmlFor="url" className="flex items-center cursor-pointer flex-1">
                          <Link2 className="w-4 h-4 mr-2 text-purple-600" />
                          <div>
                            <p className="font-medium">Masked URL</p>
                            <p className="text-xs text-gray-500">Hide the destination URL</p>
                          </div>
                        </Label>
                      </div>
                      <div className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-gray-50 cursor-pointer">
                        <RadioGroupItem value="file" id="file" />
                        <Label htmlFor="file" className="flex items-center cursor-pointer flex-1">
                          <FileUp className="w-4 h-4 mr-2 text-purple-600" />
                          <div>
                            <p className="font-medium">File Upload</p>
                            <p className="text-xs text-gray-500">Share a secure file</p>
                          </div>
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>

                  {dropType === "url" && (
                    <div>
                      <Label htmlFor="maskedUrl" className="text-sm font-medium mb-1.5 block">
                        URL to Mask <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="maskedUrl"
                        type="url"
                        {...register("maskedUrl")}
                        placeholder="https://example.com/sensitive-document"
                        className={errors.maskedUrl ? "border-red-500" : ""}
                      />
                      {errors.maskedUrl && (
                        <p className="text-sm text-red-500 mt-1">{errors.maskedUrl.message}</p>
                      )}
                    </div>
                  )}

                  {dropType === "file" && (
                    <div>
                      <Label htmlFor="file" className="text-sm font-medium mb-1.5 block">
                        Upload File <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="file"
                        type="file"
                        onChange={handleFileChange}
                        className="cursor-pointer"
                      />
                      {uploadedFile && (
                        <div className="mt-2 p-2 bg-purple-50 rounded-md">
                          <p className="text-sm text-purple-700 font-medium">
                            {uploadedFile.name}
                          </p>
                          <p className="text-xs text-purple-600">
                            {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Access Control Card */}
              <Card className="shadow-sm">
                <CardHeader className="pb-4">
                  <CardTitle className="text-xl flex items-center gap-2">
                    <Clock className="w-5 h-5" />
                    Access Control
                  </CardTitle>
                  <CardDescription>Set time limits and access rules</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium mb-3 block">Expiration Time</Label>
                    <RadioGroup
                      value={expiresIn}
                      onValueChange={(value) => setValue("expiresIn", value as any)}
                      className="grid grid-cols-2 gap-2"
                    >
                      <div className="flex items-center space-x-2 p-2 rounded-md border hover:bg-gray-50">
                        <RadioGroupItem value="1h" id="1h" />
                        <Label htmlFor="1h" className="cursor-pointer text-sm">1 Hour</Label>
                      </div>
                      <div className="flex items-center space-x-2 p-2 rounded-md border hover:bg-gray-50">
                        <RadioGroupItem value="24h" id="24h" />
                        <Label htmlFor="24h" className="cursor-pointer text-sm">24 Hours</Label>
                      </div>
                      <div className="flex items-center space-x-2 p-2 rounded-md border hover:bg-gray-50">
                        <RadioGroupItem value="7d" id="7d" />
                        <Label htmlFor="7d" className="cursor-pointer text-sm">7 Days</Label>
                      </div>
                      <div className="flex items-center space-x-2 p-2 rounded-md border hover:bg-gray-50">
                        <RadioGroupItem value="30d" id="30d" />
                        <Label htmlFor="30d" className="cursor-pointer text-sm">30 Days</Label>
                      </div>
                      <div className="col-span-2 flex items-center space-x-2 p-2 rounded-md border hover:bg-gray-50">
                        <RadioGroupItem value="custom" id="custom" />
                        <Label htmlFor="custom" className="cursor-pointer text-sm">Custom Date & Time</Label>
                      </div>
                    </RadioGroup>
                  </div>

                  {expiresIn === "custom" && (
                    <div>
                      <Label htmlFor="customExpiry" className="text-sm font-medium mb-1.5 block">
                        Custom Expiry
                      </Label>
                      <Input
                        id="customExpiry"
                        type="datetime-local"
                        {...register("customExpiry")}
                        min={new Date().toISOString().slice(0, 16)}
                        className="w-full"
                      />
                    </div>
                  )}

                  <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
                      <Label htmlFor="oneTimeAccess" className="cursor-pointer">
                        <p className="font-medium text-sm">One-time Access</p>
                        <p className="text-xs text-gray-500">Expires after first view</p>
                      </Label>
                      <Switch
                        id="oneTimeAccess"
                        checked={watch("oneTimeAccess")}
                        onCheckedChange={(checked) => setValue("oneTimeAccess", checked)}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right Column */}
            <div className="space-y-6">
              {/* Recipients Card */}
              <Card className="shadow-sm h-full">
                <CardHeader className="pb-4">
                  <CardTitle className="text-xl flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    Recipients
                  </CardTitle>
                  <CardDescription>Who can access this drop?</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="recipients" className="text-sm font-medium mb-1.5 block">
                      Email Addresses <span className="text-red-500">*</span>
                    </Label>
                    <Textarea
                      id="recipients"
                      {...register("recipients")}
                      placeholder="john@example.com, jane@example.com&#10;&#10;or enter one email per line..."
                      rows={12}
                      className={`resize-none ${errors.recipients ? "border-red-500" : ""}`}
                    />
                    {errors.recipients && (
                      <p className="text-sm text-red-500 mt-1">{errors.recipients.message}</p>
                    )}
                    <p className="text-xs text-gray-500 mt-2">
                      Separate multiple emails with commas or new lines
                    </p>
                  </div>

                  <div className="pt-4">
                    <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
                      <Label htmlFor="sendNotifications" className="cursor-pointer">
                        <p className="font-medium text-sm">Email Notifications</p>
                        <p className="text-xs text-gray-500">Notify recipients when drop is created</p>
                      </Label>
                      <Switch
                        id="sendNotifications"
                        checked={watch("sendNotifications")}
                        onCheckedChange={(checked) => setValue("sendNotifications", checked)}
                      />
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex justify-end space-x-3 pt-6">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => router.push("/dashboard")}
                      disabled={isSubmitting}
                      className="px-6"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={isSubmitting || (dropType === "file" && !uploadedFile)}
                      className="px-6 bg-purple-600 hover:bg-purple-700"
                    >
                      {isSubmitting ? (
                        <>Creating Drop...</>
                      ) : (
                        <>
                          <Shield className="w-4 h-4 mr-2" />
                          Create Secure Drop
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}