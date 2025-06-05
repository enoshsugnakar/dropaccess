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
import { FileUp, Link2, Shield, Users, Clock, Info, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { useAuth } from "@/components/AuthProvider";

// Robust validation: maskedUrl is required and must be a valid URL only if dropType === "url"
const dropFormSchema = z
  .object({
    name: z.string().max(100).optional(),
    description: z.string().max(500).optional(),
    dropType: z.enum(["file", "url"]),
    maskedUrl: z.string().optional(),
    recipients: z.string().min(1, "At least one recipient email is required"),
    expiresIn: z.enum(["1h", "24h", "7d", "30d", "custom"]),
    customExpiry: z.string().optional(),
    oneTimeAccess: z.boolean().default(false),
    sendNotifications: z.boolean().default(true),
  })
  .superRefine((data, ctx) => {
    // Masked URL: required and must be a valid URL if dropType is "url"
    if (data.dropType === "url") {
      if (!data.maskedUrl || !data.maskedUrl.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "A URL is required when using Masked URL.",
          path: ["maskedUrl"],
        });
      } else {
        try {
          // Will throw if not a valid URL
          new URL(data.maskedUrl.trim());
        } catch {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Please enter a valid URL (e.g. https://example.com).",
            path: ["maskedUrl"],
          });
        }
      }
    }
    // Custom expiry required if expiresIn is custom
    if (data.expiresIn === "custom" && !data.customExpiry) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Please select a custom expiry date",
        path: ["customExpiry"],
      });
    }
  });

type DropFormData = z.infer<typeof dropFormSchema>;

export function DropForm() {
  const router = useRouter();
  const { user } = useAuth();
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
      name: "Untitled",
      description: "",
      dropType: "url",
      maskedUrl: "",
      recipients: "",
      expiresIn: "24h",
      customExpiry: "",
      oneTimeAccess: false,
      sendNotifications: true,
    },
  });

  const dropType = watch("dropType");
  const expiresIn = watch("expiresIn");
  const oneTimeAccess = watch("oneTimeAccess");
  const sendNotifications = watch("sendNotifications");

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

  const handleFileUpload = async (file: File, dropId: string): Promise<string> => {
    const fileExt = file.name.split(".").pop() ?? "bin";
    const randomPortion = Math.random().toString(36).substring(2, 15);
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
    if (!user) {
      toast.error("Please sign in to create a drop");
      router.push("/auth");
      return;
    }

    // Additional validation for file upload
    if (data.dropType === "file" && !uploadedFile) {
      toast.error("Please select a file to upload");
      return;
    }

    setIsSubmitting(true);
    try {
      const dropPayload = {
        owner_id: user.id,
        name: data.name,
        drop_type: data.dropType,
        masked_url: data.dropType === "url" ? data.maskedUrl : null,
        expires_at: calculateExpiryDate(data.expiresIn, data.customExpiry),
        description: data.description || null,
        one_time_access: data.oneTimeAccess,
        is_active: true,
      };

      const { data: insertedDrop, error: dropError } = await supabase
        .from("drops")
        .insert(dropPayload)
        .select()
        .single();

      if (dropError || !insertedDrop) {
        throw dropError ?? new Error("Failed to create drop");
      }

      // Handle file upload if needed
      if (data.dropType === "file" && uploadedFile) {
        const fullPath = await handleFileUpload(uploadedFile, insertedDrop.id);
        const { error: updateError } = await supabase
          .from("drops")
          .update({ file_path: fullPath })
          .eq("id", insertedDrop.id);

        if (updateError) throw updateError;
      }

      // Process recipients
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

      // Send notifications if enabled
      if (data.sendNotifications) {
        // TODO: Implement email notification logic
        console.log("Would send notifications to:", recipientEmails);
      }

      toast.success("Drop created successfully!");
      reset();
      router.push(`/drops/${insertedDrop.id}/manage`);
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
      e.target.value = "";
      return;
    }
    
    setUploadedFile(file);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 pt-20 pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <Shield className="w-8 h-8 text-purple-600" />
            Create Secure Drop
          </h1>
          <p className="mt-2 text-lg text-gray-600 dark:text-gray-400">
            Share files and links securely with time-based access control
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column */}
            <div className="space-y-6">
              {/* Drop Details Card */}
              <Card className="shadow-lg">
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
                      className={errors.name ? "border-red-500 focus:ring-red-500" : ""}
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
                      rows={3}
                      className="resize-none"
                    />
                    {errors.description && (
                      <p className="text-sm text-red-500 mt-1">{errors.description.message}</p>
                    )}
                  </div>

                  <div>
                    <Label className="text-sm font-medium mb-3 block">Share Type</Label>
                    <RadioGroup
                      value={dropType}
                      onValueChange={(value) => setValue("dropType", value as "file" | "url")}
                      className="space-y-2"
                    >
                      <div className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors">
                        <RadioGroupItem value="url" id="url" />
                        <Label htmlFor="url" className="flex items-center cursor-pointer flex-1">
                          <Link2 className="w-4 h-4 mr-2 text-purple-600" />
                          <div>
                            <p className="font-medium">Masked URL</p>
                            <p className="text-xs text-gray-500">Hide the destination URL</p>
                          </div>
                        </Label>
                      </div>
                      <div className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors">
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
                        className={errors.maskedUrl ? "border-red-500 focus:ring-red-500" : ""}
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
                        accept="*/*"
                      />
                      {uploadedFile && (
                        <div className="mt-2 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-md">
                          <p className="text-sm text-purple-700 dark:text-purple-300 font-medium truncate">
                            {uploadedFile.name}
                          </p>
                          <p className="text-xs text-purple-600 dark:text-purple-400">
                            {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                      )}
                      <p className="text-xs text-gray-500 mt-1">Maximum file size: 100MB</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Access Control Card */}
              <Card className="shadow-lg">
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
                      <div className="flex items-center space-x-2 p-2 rounded-md border hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                        <RadioGroupItem value="1h" id="1h" />
                        <Label htmlFor="1h" className="cursor-pointer text-sm">1 Hour</Label>
                      </div>
                      <div className="flex items-center space-x-2 p-2 rounded-md border hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                        <RadioGroupItem value="24h" id="24h" />
                        <Label htmlFor="24h" className="cursor-pointer text-sm">24 Hours</Label>
                      </div>
                      <div className="flex items-center space-x-2 p-2 rounded-md border hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                        <RadioGroupItem value="7d" id="7d" />
                        <Label htmlFor="7d" className="cursor-pointer text-sm">7 Days</Label>
                      </div>
                      <div className="flex items-center space-x-2 p-2 rounded-md border hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                        <RadioGroupItem value="30d" id="30d" />
                        <Label htmlFor="30d" className="cursor-pointer text-sm">30 Days</Label>
                      </div>
                      <div className="col-span-2 flex items-center space-x-2 p-2 rounded-md border hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                        <RadioGroupItem value="custom" id="custom" />
                        <Label htmlFor="custom" className="cursor-pointer text-sm">Custom Date & Time</Label>
                      </div>
                    </RadioGroup>
                  </div>

                  {expiresIn === "custom" && (
                    <div>
                      <Label htmlFor="customExpiry" className="text-sm font-medium mb-1.5 block">
                        Custom Expiry <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="customExpiry"
                        type="datetime-local"
                        {...register("customExpiry")}
                        min={new Date().toISOString().slice(0, 16)}
                        className={errors.customExpiry ? "border-red-500 focus:ring-red-500" : ""}
                      />
                      {errors.customExpiry && (
                        <p className="text-sm text-red-500 mt-1">{errors.customExpiry.message}</p>
                      )}
                    </div>
                  )}

                  <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                      <Label htmlFor="oneTimeAccess" className="cursor-pointer">
                        <p className="font-medium text-sm">One-time Access</p>
                        <p className="text-xs text-gray-500">Expires after first view</p>
                      </Label>
                      <Switch
                        id="oneTimeAccess"
                        checked={oneTimeAccess}
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
              <Card className="shadow-lg h-full">
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
                      className={`resize-none font-mono text-sm ${errors.recipients ? "border-red-500 focus:ring-red-500" : ""}`}
                    />
                    {errors.recipients && (
                      <p className="text-sm text-red-500 mt-1">{errors.recipients.message}</p>
                    )}
                    <p className="text-xs text-gray-500 mt-2">
                      Separate multiple emails with commas or new lines
                    </p>
                  </div>

                  <div className="pt-4">
                    <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                      <Label htmlFor="sendNotifications" className="cursor-pointer">
                        <p className="font-medium text-sm">Email Notifications</p>
                        <p className="text-xs text-gray-500">Notify recipients when drop is created</p>
                      </Label>
                      <Switch
                        id="sendNotifications"
                        checked={sendNotifications}
                        onCheckedChange={(checked) => setValue("sendNotifications", checked)}
                      />
                    </div>
                  </div>

                  {/* Summary */}
                  <div className="mt-6 p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                    <h4 className="text-sm font-medium text-purple-900 dark:text-purple-100 mb-2">Drop Summary</h4>
                    <ul className="space-y-1 text-xs text-purple-700 dark:text-purple-300">
                      <li>• Type: {dropType === "url" ? "Masked URL" : "File Upload"}</li>
                      <li>• Expires: {expiresIn === "custom" ? "Custom date" : expiresIn}</li>
                      <li>• One-time access: {oneTimeAccess ? "Yes" : "No"}</li>
                      <li>• Notifications: {sendNotifications ? "Enabled" : "Disabled"}</li>
                    </ul>
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
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Creating Drop...
                        </>
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