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
import { useState, useRef } from "react";
import { FileUp, Link2, Shield, Users, Clock, Info, Loader2, Upload, X, CheckCircle } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { useAuth } from "@/components/AuthProvider";
import { Navbar } from "@/components/Navbar";

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
}

export function DropForm() {
  const router = useRouter();
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

      // Create the drop first - REMOVED allow_download field
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

  const handleFileSelection = (file: File) => {
    if (file.size > 100 * 1024 * 1024) {
      toast.error("File size must be less than 100MB");
      return;
    }
    
    setUploadedFile(file);
    // Clear file error if exists
    if (errors.file) {
      setErrors(prev => ({ ...prev, file: "" }));
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    handleFileSelection(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelection(files[0]);
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

  const removeFile = () => {
    setUploadedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const openFileDialog = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const getRecipientCount = () => {
    if (!formData.recipients.trim()) return 0;
    return formData.recipients
      .split(/[,\n]/)
      .map(email => email.trim())
      .filter(email => email.length > 0).length;
  };

  const getExpiryDisplay = () => {
    if (formData.expiresIn === "custom") {
      return formData.customExpiry ? new Date(formData.customExpiry).toLocaleDateString() : "Custom date";
    }
    const map = {
      "1h": "1 Hour",
      "24h": "24 Hours", 
      "7d": "7 Days",
      "30d": "30 Days"
    };
    return map[formData.expiresIn];
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pt-20">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-medium text-gray-900 dark:text-white flex items-center gap-3">
            <Shield className="w-6 h-6 text-primary" />
            Create Secure Drop
          </h1>
          <p className="mt-1 text-gray-500 dark:text-gray-400">
            Share files and links securely with time-based access control
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column - Main Content */}
            <div className="lg:col-span-2 space-y-6">
              {/* Drop Details Card */}
              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-2 mb-4">
                  <Info className="w-5 h-5 text-primary" />
                  <h2 className="text-lg font-medium text-gray-900 dark:text-white">Drop Information</h2>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="name" className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">
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
                    <Label htmlFor="description" className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">
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
                </div>
              </div>

              {/* Share Type Card */}
              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-2 mb-4">
                  <Shield className="w-5 h-5 text-primary" />
                  <h2 className="text-lg font-medium text-gray-900 dark:text-white">Share Type</h2>
                </div>
                
                <RadioGroup
                  value={formData.dropType}
                  onValueChange={handleDropTypeChange}
                  className="space-y-3"
                >
                  <div className={`flex items-center space-x-3 p-4 rounded-lg border-2 transition-colors cursor-pointer ${
                    formData.dropType === "url" 
                      ? "border-primary bg-primary/5" 
                      : "border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  }`}>
                    <RadioGroupItem value="url" id="url" />
                    <Label htmlFor="url" className="flex items-center cursor-pointer flex-1">
                      <Link2 className="w-5 h-5 mr-3 text-primary" />
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">Masked URL</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Hide the destination URL from recipients</p>
                      </div>
                    </Label>
                  </div>
                  <div className={`flex items-center space-x-3 p-4 rounded-lg border-2 transition-colors cursor-pointer ${
                    formData.dropType === "file" 
                      ? "border-primary bg-primary/5" 
                      : "border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  }`}>
                    <RadioGroupItem value="file" id="file" />
                    <Label htmlFor="file" className="flex items-center cursor-pointer flex-1">
                      <FileUp className="w-5 h-5 mr-3 text-primary" />
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">File Upload</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Share a secure file with recipients</p>
                      </div>
                    </Label>
                  </div>
                </RadioGroup>

                {formData.dropType === "url" && (
                  <div className="mt-4">
                    <Label htmlFor="maskedUrl" className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">
                      URL to Mask <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="maskedUrl"
                      value={formData.maskedUrl}
                      onChange={(e) => updateField("maskedUrl", e.target.value)}
                      placeholder="https://docs.google.com/sensitive-document"
                      className={errors.maskedUrl ? "border-red-500 focus:ring-red-500" : ""}
                    />
                    {errors.maskedUrl && (
                      <p className="text-sm text-red-500 mt-1">{errors.maskedUrl}</p>
                    )}
                  </div>
                )}

                {formData.dropType === "file" && (
                  <div className="mt-4">
                    <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">
                      Upload File <span className="text-red-500">*</span>
                    </Label>
                    
                    {!uploadedFile ? (
                      <div>
                        <input
                          ref={fileInputRef}
                          type="file"
                          onChange={handleFileChange}
                          className="hidden"
                          accept="*/*"
                        />
                        <div
                          onDragOver={handleDragOver}
                          onDragLeave={handleDragLeave}
                          onDrop={handleDrop}
                          onClick={openFileDialog}
                          className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer transition-all duration-200 ${
                            isDragOver
                              ? "border-primary bg-primary/10 scale-[1.02]"
                              : errors.file 
                                ? "border-red-500 bg-red-50 dark:bg-red-900/20" 
                                : "border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 hover:border-gray-400 dark:hover:border-gray-500"
                          }`}
                        >
                          <div className="flex flex-col items-center justify-center pt-5 pb-6">
                            <Upload className={`w-8 h-8 mb-2 transition-colors ${isDragOver ? "text-primary" : "text-gray-400"}`} />
                            <p className="mb-2 text-sm text-gray-500 dark:text-gray-400">
                              <span className="font-medium">Click to upload</span> or drag and drop
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Maximum file size: 100MB</p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <CheckCircle className="w-5 h-5 text-green-600" />
                            <div>
                              <p className="font-medium text-gray-900 dark:text-white truncate max-w-xs">
                                {uploadedFile.name}
                              </p>
                              <p className="text-sm text-gray-500 dark:text-gray-400">
                                {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB
                              </p>
                            </div>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={removeFile}
                            className="text-gray-500 hover:text-red-500"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                    
                    {errors.file && (
                      <p className="text-sm text-red-500 mt-1">{errors.file}</p>
                    )}
                  </div>
                )}
              </div>

              {/* Access Control Card */}
              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-2 mb-4">
                  <Clock className="w-5 h-5 text-primary" />
                  <h2 className="text-lg font-medium text-gray-900 dark:text-white">Access Control</h2>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 block">Expiration Time</Label>
                    <RadioGroup
                      value={formData.expiresIn}
                      onValueChange={(value) => updateField("expiresIn", value)}
                      className="grid grid-cols-2 gap-3"
                    >
                      {[
                        { value: "1h", label: "1 Hour" },
                        { value: "24h", label: "24 Hours" },
                        { value: "7d", label: "7 Days" },
                        { value: "30d", label: "30 Days" }
                      ].map((option) => (
                        <div key={option.value} className={`flex items-center space-x-2 p-3 rounded-lg border-2 transition-colors cursor-pointer ${
                          formData.expiresIn === option.value 
                            ? "border-primary bg-primary/5" 
                            : "border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                        }`}>
                          <RadioGroupItem value={option.value} id={option.value} />
                          <Label htmlFor={option.value} className="cursor-pointer font-medium text-gray-900 dark:text-white">
                            {option.label}
                          </Label>
                        </div>
                      ))}
                      <div className={`col-span-2 flex items-center space-x-2 p-3 rounded-lg border-2 transition-colors cursor-pointer ${
                        formData.expiresIn === "custom" 
                          ? "border-primary bg-primary/5" 
                          : "border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                      }`}>
                        <RadioGroupItem value="custom" id="custom" />
                        <Label htmlFor="custom" className="cursor-pointer font-medium text-gray-900 dark:text-white">
                          Custom Date & Time
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>

                  {formData.expiresIn === "custom" && (
                    <div>
                      <Label htmlFor="customExpiry" className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">
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

                  <div className="pt-2">
                    <div className="flex items-center justify-between p-4 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                      <Label htmlFor="oneTimeAccess" className="cursor-pointer">
                        <p className="font-medium text-gray-900 dark:text-white">One-time Access</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Drop expires after first view</p>
                      </Label>
                      <Switch
                        id="oneTimeAccess"
                        checked={formData.oneTimeAccess}
                        onCheckedChange={(checked) => updateField("oneTimeAccess", checked)}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column - Recipients & Summary */}
            <div className="space-y-6">
              {/* Recipients Card */}
              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-2 mb-4">
                  <Users className="w-5 h-5 text-primary" />
                  <h2 className="text-lg font-medium text-gray-900 dark:text-white">Recipients</h2>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="recipients" className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">
                      Email Addresses <span className="text-red-500">*</span>
                    </Label>
                    <Textarea
                      id="recipients"
                      value={formData.recipients}
                      onChange={(e) => updateField("recipients", e.target.value)}
                      placeholder="john@example.com, jane@example.com&#10;&#10;or enter one email per line..."
                      rows={8}
                      className={`resize-none font-mono text-sm ${errors.recipients ? "border-red-500 focus:ring-red-500" : ""}`}
                    />
                    {errors.recipients && (
                      <p className="text-sm text-red-500 mt-1">{errors.recipients}</p>
                    )}
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                      Separate multiple emails with commas or new lines
                    </p>
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                    <Label htmlFor="sendNotifications" className="cursor-pointer">
                      <p className="font-medium text-gray-900 dark:text-white">Email Notifications</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Notify recipients when drop is created</p>
                    </Label>
                    <Switch
                      id="sendNotifications"
                      checked={formData.sendNotifications}
                      onCheckedChange={(checked) => updateField("sendNotifications", checked)}
                    />
                  </div>
                </div>
              </div>

              {/* Summary Card */}
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-6">
                <h3 className="font-medium text-gray-900 dark:text-white mb-4">Drop Summary</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Type:</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {formData.dropType === "url" ? "Masked URL" : "File Upload"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Recipients:</span>
                    <span className="font-medium text-gray-900 dark:text-white">{getRecipientCount()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Expires:</span>
                    <span className="font-medium text-gray-900 dark:text-white">{getExpiryDisplay()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">One-time:</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {formData.oneTimeAccess ? "Yes" : "No"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Notifications:</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {formData.sendNotifications ? "Enabled" : "Disabled"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col gap-3">
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full font-medium py-3"
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
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push("/dashboard")}
                  disabled={isSubmitting}
                  className="w-full font-medium"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}