"use client";
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

interface FormData {
  name: string;
  description: string;
  dropType: "file" | "url";
  maskedUrl: string;
  recipients: string;
  expiresIn: "1h" | "24h" | "7d" | "30d" | "custom";
  customExpiry: string;
  oneTimeAccess: boolean;
  sendNotifications: boolean;
  allowDownload: boolean;
}

export function DropForm() {
  const router = useRouter();
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [formData, setFormData] = useState<FormData>({
    name: "",
    description: "",
    dropType: "url",
    maskedUrl: "",
    recipients: "",
    expiresIn: "24h",
    customExpiry: "",
    oneTimeAccess: false,
    sendNotifications: true,
    allowDownload: false,
  });

  const updateField = (field: keyof FormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: "" }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Validate name
    if (!formData.name.trim()) {
      newErrors.name = "Drop name is required";
    } else if (formData.name.length > 100) {
      newErrors.name = "Drop name must be less than 100 characters";
    }

    // Validate URL if dropType is url
    if (formData.dropType === "url") {
      if (!formData.maskedUrl.trim()) {
        newErrors.maskedUrl = "URL is required for masked URL drops";
      } else {
        try {
          new URL(formData.maskedUrl.trim());
        } catch {
          newErrors.maskedUrl = "Please enter a valid URL (e.g., https://example.com)";
        }
      }
    }

    // Validate file if dropType is file
    if (formData.dropType === "file" && !uploadedFile) {
      newErrors.file = "Please select a file to upload";
    }

    // Validate recipients
    if (!formData.recipients.trim()) {
      newErrors.recipients = "At least one recipient email is required";
    } else {
      const emails = formData.recipients
        .split(/[,\n]/)
        .map(email => email.trim())
        .filter(email => email.length > 0);
      
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const invalidEmails = emails.filter(email => !emailRegex.test(email));
      
      if (invalidEmails.length > 0) {
        newErrors.recipients = `Invalid email format: ${invalidEmails.join(', ')}`;
      }
    }

    // Validate custom expiry
    if (formData.expiresIn === "custom") {
      if (!formData.customExpiry) {
        newErrors.customExpiry = "Please select a custom expiry date and time";
      } else {
        const expiryDate = new Date(formData.customExpiry);
        const now = new Date();
        if (expiryDate <= now) {
          newErrors.customExpiry = "Expiry date must be in the future";
        }
      }
    }

    // Validate description length
    if (formData.description && formData.description.length > 500) {
      newErrors.description = "Description must be less than 500 characters";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Function to ensure user exists in users table
  const ensureUserExists = async () => {
    if (!user) return false;

    try {
      // Check if user already exists in users table
      const { data: existingUser, error: checkError } = await supabase
        .from("users")
        .select("id")
        .eq("id", user.id)
        .single();

      if (checkError && checkError.code !== "PGRST116") {
        // PGRST116 is "not found" error, other errors are real problems
        console.error("Error checking user existence:", checkError);
        throw checkError;
      }

      // If user doesn't exist, create them
      if (!existingUser) {
        console.log("User not found in users table, creating...");
        
        const { data: newUser, error: insertError } = await supabase
          .from("users")
          .insert({
            id: user.id,
            email: user.email || "",
            is_paid: false,
          })
          .select()
          .single();

        if (insertError) {
          console.error("Error creating user:", insertError);
          throw insertError;
        }

        console.log("User created successfully:", newUser);
      } else {
        console.log("User already exists in users table");
      }

      return true;
    } catch (error) {
      console.error("Error ensuring user exists:", error);
      return false;
    }
  };

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

  // Fixed file upload function - matches storage policy structure
  const handleFileUpload = async (file: File, dropId: string): Promise<string> => {
    if (!user) throw new Error("User not authenticated");
    
    const fileExt = file.name.split(".").pop() ?? "bin";
    const timestamp = Date.now();
    const randomPortion = Math.random().toString(36).substring(2, 10);
    const fileName = `${timestamp}_${randomPortion}.${fileExt}`;
    
    // Path structure: userId/dropId/filename
    // This matches the storage policy: auth.uid()::text = (storage.foldername(name))[1]
    const filePath = `${user.id}/${dropId}/${fileName}`;
    
    console.log("Uploading file to path:", filePath);
    
    const { error: uploadError, data: uploadData } = await supabase.storage
      .from("drops")
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) {
      console.error("File upload error:", uploadError);
      throw uploadError;
    }
    
    console.log("File uploaded successfully:", uploadData);
    return filePath;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      toast.error("Please sign in to create a drop");
      router.push("/auth");
      return;
    }

    if (!validateForm()) {
      toast.error("Please fix the errors below");
      return;
    }

    setIsSubmitting(true);
    let insertedDrop: any = null;
    
    try {
      // First, ensure the user exists in the users table
      const userExists = await ensureUserExists();
      if (!userExists) {
        throw new Error("Failed to create or verify user account");
      }

      // Create the drop first
      const dropPayload = {
        owner_id: user.id,
        name: formData.name.trim(),
        drop_type: formData.dropType,
        masked_url: formData.dropType === "url" ? formData.maskedUrl.trim() : null,
        expires_at: calculateExpiryDate(formData.expiresIn, formData.customExpiry),
        description: formData.description.trim() || null,
        one_time_access: formData.oneTimeAccess,
        is_active: true,
        file_path: null, // Initialize as null, will update after file upload
        allow_download: formData.dropType === "file" ? formData.allowDownload : null,
      };

      console.log("Creating drop with payload:", dropPayload);

      const { data: dropData, error: dropError } = await supabase
        .from("drops")
        .insert(dropPayload)
        .select()
        .single();

      if (dropError || !dropData) {
        console.error("Drop creation error:", dropError);
        throw dropError ?? new Error("Failed to create drop");
      }

      insertedDrop = dropData;
      console.log("Drop created successfully:", insertedDrop);

      // Handle file upload if needed
      if (formData.dropType === "file" && uploadedFile) {
        try {
          console.log("Starting file upload for drop:", insertedDrop.id);
          const filePath = await handleFileUpload(uploadedFile, insertedDrop.id);
          
          console.log("File uploaded, updating drop with file_path:", filePath);
          const { error: updateError } = await supabase
            .from("drops")
            .update({ file_path: filePath })
            .eq("id", insertedDrop.id)
            .eq("owner_id", user.id); // Add owner_id check for RLS

          if (updateError) {
            console.error("Error updating drop with file path:", updateError);
            throw updateError;
          }
          
          console.log("Drop updated with file path successfully");
        } catch (fileError) {
          console.error("File upload failed:", fileError);
          // Cleanup: delete the drop if file upload fails
          await supabase.from("drops").delete().eq("id", insertedDrop.id);
          throw new Error(`File upload failed: {fileError.message}`);
        }
      }

      // Process recipients
      const recipientEmails = formData.recipients
        .split(/[,\n]/)
        .map((email) => email.trim())
        .filter((email) => email.length > 0);

      if (recipientEmails.length > 0) {
        const recipientsPayload = recipientEmails.map((email) => ({
          drop_id: insertedDrop.id,
          email,
        }));

        const { error: recipientsError } = await supabase
          .from("drop_recipients")
          .insert(recipientsPayload);

        if (recipientsError) {
          console.error("Recipients error:", recipientsError);
          throw recipientsError;
        }

        console.log("Recipients added successfully");
      }

      // Send notifications if enabled
      if (formData.sendNotifications) {
        console.log("Would send notifications to:", recipientEmails);
      }

      toast.success("Drop created successfully!");
      
      // Reset form
      setFormData({
        name: "",
        description: "",
        dropType: "url",
        maskedUrl: "",
        recipients: "",
        expiresIn: "24h",
        customExpiry: "",
        oneTimeAccess: false,
        sendNotifications: true,
        allowDownload: false,
      });
      setUploadedFile(null);
      setErrors({});
      
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
    // Clear file error if exists
    if (errors.file) {
      setErrors(prev => ({ ...prev, file: "" }));
    }
  };

  const handleDropTypeChange = (value: "file" | "url") => {
    updateField("dropType", value);
    if (value === "file") {
      updateField("maskedUrl", "");
    }
    if (value === "url") {
      setUploadedFile(null);
    }
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

        <form onSubmit={handleSubmit}>
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
                      value={formData.name}
                      onChange={(e) => updateField("name", e.target.value)}
                      placeholder="e.g., Q4 Financial Report"
                      className={errors.name ? "border-red-500 focus:ring-red-500" : ""}
                    />
                    {errors.name && (
                      <p className="text-sm text-red-500 mt-1">{errors.name}</p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="description" className="text-sm font-medium mb-1.5 block">
                      Description
                    </Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => updateField("description", e.target.value)}
                      placeholder="Optional: Add context for recipients..."
                      rows={3}
                      className="resize-none"
                    />
                    {errors.description && (
                      <p className="text-sm text-red-500 mt-1">{errors.description}</p>
                    )}
                  </div>

                  <div>
                    <Label className="text-sm font-medium mb-3 block">Share Type</Label>
                    <RadioGroup
                      value={formData.dropType}
                      onValueChange={handleDropTypeChange}
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

                  {formData.dropType === "url" && (
                    <div>
                      <Label htmlFor="maskedUrl" className="text-sm font-medium mb-1.5 block">
                        URL to Mask <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="maskedUrl"
                        value={formData.maskedUrl}
                        onChange={(e) => updateField("maskedUrl", e.target.value)}
                        placeholder="https://example.com/sensitive-document"
                        className={errors.maskedUrl ? "border-red-500 focus:ring-red-500" : ""}
                      />
                      {errors.maskedUrl && (
                        <p className="text-sm text-red-500 mt-1">{errors.maskedUrl}</p>
                      )}
                    </div>
                  )}

                  {formData.dropType === "file" && (
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
                      {errors.file && (
                        <p className="text-sm text-red-500 mt-1">{errors.file}</p>
                      )}
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
                  {formData.dropType === "file" && (
  <div className="space-y-3 pt-2">
    <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
      <Label htmlFor="allowDownload" className="cursor-pointer">
        <p className="font-medium text-sm">Allow Downloads</p>
        <p className="text-xs text-gray-500">Recipients can download the file</p>
      </Label>
      <Switch
        id="allowDownload"
        checked={formData.allowDownload}
        onCheckedChange={(checked) => updateField("allowDownload", checked)}
      />
    </div>
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
                      value={formData.expiresIn}
                      onValueChange={(value) => updateField("expiresIn", value)}
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

                  {formData.expiresIn === "custom" && (
                    <div>
                      <Label htmlFor="customExpiry" className="text-sm font-medium mb-1.5 block">
                        Custom Expiry <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="customExpiry"
                        type="datetime-local"
                        value={formData.customExpiry}
                        onChange={(e) => updateField("customExpiry", e.target.value)}
                        min={new Date().toISOString().slice(0, 16)}
                        className={errors.customExpiry ? "border-red-500 focus:ring-red-500" : ""}
                      />
                      {errors.customExpiry && (
                        <p className="text-sm text-red-500 mt-1">{errors.customExpiry}</p>
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
                        checked={formData.oneTimeAccess}
                        onCheckedChange={(checked) => updateField("oneTimeAccess", checked)}
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
                      value={formData.recipients}
                      onChange={(e) => updateField("recipients", e.target.value)}
                      placeholder="john@example.com, jane@example.com&#10;&#10;or enter one email per line..."
                      rows={12}
                      className={`resize-none font-mono text-sm ${errors.recipients ? "border-red-500 focus:ring-red-500" : ""}`}
                    />
                    {errors.recipients && (
                      <p className="text-sm text-red-500 mt-1">{errors.recipients}</p>
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
                        checked={formData.sendNotifications}
                        onCheckedChange={(checked) => updateField("sendNotifications", checked)}
                      />
                    </div>
                  </div>

                  {/* Summary */}
                  <div className="mt-6 p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                    <h4 className="text-sm font-medium text-purple-900 dark:text-purple-100 mb-2">Drop Summary</h4>
                    <ul className="space-y-1 text-xs text-purple-700 dark:text-purple-300">
                      <li>• Type: {formData.dropType === "url" ? "Masked URL" : "File Upload"}</li>
                      <li>• Expires: {formData.expiresIn === "custom" ? "Custom date" : formData.expiresIn}</li>
                      <li>• One-time access: {formData.oneTimeAccess ? "Yes" : "No"}</li>
                      <li>• Notifications: {formData.sendNotifications ? "Enabled" : "Disabled"}</li>
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
                      disabled={isSubmitting}
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