"use client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { updateUsageAfterDrop } from "@/lib/usageTracking";
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
import { FileUp, Link2, Shield, Users, Clock, Info, Loader2, Upload, X, CheckCircle, Timer, CalendarDays } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { useAuth } from "@/components/AuthProvider";
import { Navbar } from "@/components/Navbar";
import { format, addHours } from "date-fns";

interface FormData {
  name: string;
  description: string;
  dropType: "file" | "url";
  maskedUrl: string;
  recipients: string;
  timerMode: "verification" | "creation";
  defaultTimeLimitHours: number | null;
  verificationDeadline: Date | undefined;
  creationExpiry: string;
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
  const [customDateTime, setCustomDateTime] = useState<string>("");

  const [formData, setFormData] = useState<FormData>({
    name: "",
    description: "",
    dropType: "url",
    maskedUrl: "",
    recipients: "",
    timerMode: "verification",
    defaultTimeLimitHours: 24,
    verificationDeadline: undefined,
    creationExpiry: "",
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

    // Validate timer settings based on mode
    if (formData.timerMode === "verification") {
      // Verification mode - only validate preset hours
      if (formData.defaultTimeLimitHours === null || formData.defaultTimeLimitHours < 1) {
        newErrors.defaultTimeLimitHours = "Time limit must be at least 1 hour for verification mode";
      } else if (formData.defaultTimeLimitHours > 8760) {
        newErrors.defaultTimeLimitHours = "Time limit cannot exceed 8760 hours (1 year)";
      }
    } else {
      // Creation mode - validate based on preset or custom
      if (formData.defaultTimeLimitHours === null) {
        // Custom mode
        if (!customDateTime) {
          newErrors.creationExpiry = "Please select a custom date and time";
        } else {
          const expiryDate = new Date(customDateTime);
          const now = new Date();
          if (expiryDate <= now) {
            newErrors.creationExpiry = "Expiry date must be in the future";
          }
        }
      } else {
        // Preset mode
        if (formData.defaultTimeLimitHours < 1) {
          newErrors.defaultTimeLimitHours = "Time limit must be at least 1 hour";
        } else if (formData.defaultTimeLimitHours > 8760) {
          newErrors.defaultTimeLimitHours = "Time limit cannot exceed 8760 hours (1 year)";
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

  // Fixed file upload function
  const handleFileUpload = async (file: File, dropId: string): Promise<string> => {
    if (!user) throw new Error("User not authenticated");
    
    const fileExt = file.name.split(".").pop() ?? "bin";
    const timestamp = Date.now();
    const randomPortion = Math.random().toString(36).substring(2, 10);
    const fileName = `${timestamp}_${randomPortion}.${fileExt}`;
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

  const getExpiryDate = () => {
    if (formData.timerMode === "creation" && formData.defaultTimeLimitHours === null) {
      // Creation mode with custom date
      return customDateTime ? new Date(customDateTime) : null;
    } else if (formData.timerMode === "creation" && formData.defaultTimeLimitHours !== null) {
      // Creation mode with preset duration
      const now = new Date();
      return addHours(now, formData.defaultTimeLimitHours);
    }
    // Verification mode doesn't use expires_at
    return null;
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

      const expiryDate = getExpiryDate();

      // Create the drop with proper timer system
      const dropPayload: any = {
        owner_id: user.id,
        name: formData.name.trim(),
        drop_type: formData.dropType,
        masked_url: formData.dropType === "url" ? formData.maskedUrl.trim() : null,
        description: formData.description.trim() || null,
        one_time_access: false,
        is_active: true,
      };

      // Set timer-specific fields
      if (formData.timerMode === "creation") {
        dropPayload.expires_at = expiryDate?.toISOString();
        dropPayload.default_time_limit_hours = null;
      } else {
        dropPayload.expires_at = null;
        dropPayload.default_time_limit_hours = formData.defaultTimeLimitHours;
      }

      // Add verification deadline for "after verification" mode
      if (formData.timerMode === "verification" && formData.verificationDeadline) {
        dropPayload.global_expires_at = formData.verificationDeadline.toISOString();
      }

      console.log("Creating drop with payload:", dropPayload);

      const { data: dropData, error: dropError } = await supabase
        .from("drops")
        .insert(dropPayload)
        .select()
        .single();

      if (dropError) {
        console.error("Drop creation error:", dropError);
        throw dropError;
      }

      if (!dropData) {
        throw new Error("Failed to create drop");
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
            .eq("owner_id", user.id);

          if (updateError) {
            console.error("Error updating drop with file path:", updateError);
            throw updateError;
          }
          
          console.log("Drop updated with file path successfully");
        } catch (fileError) {
          console.error("File upload failed:", fileError);
          await supabase.from("drops").delete().eq("id", insertedDrop.id);
          throw new Error(`File upload failed: ${(fileError as Error).message || 'Unknown error'}`);
        }
      }

      console.log("Drop created successfully:", insertedDrop);

      // ===== ADD THIS USAGE TRACKING CODE HERE =====
      try {
        // Calculate file size in MB if it's a file drop
        const fileSizeMb = formData.dropType === "file" && uploadedFile 
          ? uploadedFile.size / (1024 * 1024) 
          : 0;

        // Get recipient count
        const recipientEmails = formData.recipients
          .split(/[,\n]/)
          .map((email) => email.trim())
          .filter((email) => email.length > 0);

        // Track usage
        await updateUsageAfterDrop(user.id, recipientEmails.length, fileSizeMb);
        console.log("✅ Usage tracked successfully:", {
          userId: user.id,
          recipientCount: recipientEmails.length,
          fileSizeMb: Math.round(fileSizeMb * 100) / 100
        });
      } catch (usageError) {
        console.error("❌ Failed to track usage (non-critical):", usageError);
        // Don't fail the drop creation if usage tracking fails
      }
      // ===== END USAGE TRACKING CODE =====


      // Process recipients
      const recipientEmails = formData.recipients
        .split(/[,\n]/)
        .map((email) => email.trim())
        .filter((email) => email.length > 0);

      if (recipientEmails.length > 0) {
        const recipientsPayload = recipientEmails.map((email) => ({
          drop_id: insertedDrop.id,
          email,
          // All recipients start unverified - verification happens at access time
          verified_at: null,
          personal_expires_at: null,
          time_limit_hours: null,
        }));

        const { error: recipientsError } = await supabase
          .from("drop_recipients")
          .insert(recipientsPayload);

        if (recipientsError) {
          console.error("Recipients error:", recipientsError);
          throw recipientsError;
        }

        console.log("Recipients added successfully");

        // Send email notifications if enabled
        if (formData.sendNotifications) {
          try {
            console.log("Sending email notifications to recipients...");
            
            const emailResponse = await fetch('/api/send-drop-notification', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                dropId: insertedDrop.id,
                recipientEmails: recipientEmails,
                dropData: insertedDrop,
                creatorEmail: user.email || 'Unknown User'
              }),
            });

            const emailResult = await emailResponse.json();
            
            if (!emailResponse.ok) {
              console.error('Email API error:', emailResult);
              // Don't throw here - drop creation was successful, just email failed
              toast.error(`Drop created but failed to send ${emailResult.error ? 'some' : ''} notifications`);
            } else {
              console.log('Email notifications sent:', emailResult);
              if (emailResult.results.failed > 0) {
                toast.error(`Drop created! Sent ${emailResult.results.successful}/${recipientEmails.length} notifications successfully`);
              } else {
                toast.success(`Drop created! All ${emailResult.results.successful} notifications sent successfully`);
              }
            }
          } catch (emailError) {
            console.error('Error sending email notifications:', emailError);
            // Don't throw here - drop creation was successful, just email failed
            toast.error('Drop created but failed to send email notifications');
          }
        } else {
          // No notifications requested
          const successMessage = formData.timerMode === "verification" 
            ? "Drop created! Share the link manually with recipients."
            : "Drop created! Share the link manually with recipients.";
          
          toast.success(successMessage);
        }
      } else {
        // No recipients - just show success
        toast.success("Drop created successfully!");
      }

      // Reset form
      setFormData({
        name: "",
        description: "",
        dropType: "url",
        maskedUrl: "",
        recipients: "",
        timerMode: "verification",
        defaultTimeLimitHours: 24,
        verificationDeadline: undefined,
        creationExpiry: "",
        sendNotifications: true,
      });
      setUploadedFile(null);
      setCustomDateTime("");
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

  const getTimeLimitDisplay = () => {
    if (formData.timerMode === "creation" && formData.defaultTimeLimitHours === null) {
      return customDateTime ? format(new Date(customDateTime), "MMM d, yyyy 'at' hh:mm aa") : "Custom - Not set";
    }
    
    const hours = formData.defaultTimeLimitHours;
    if (!hours) return "Not set";
    
    if (hours < 24) {
      return `${hours} hour${hours !== 1 ? 's' : ''}`;
    } else if (hours % 24 === 0) {
      const days = hours / 24;
      return `${days} day${days !== 1 ? 's' : ''}`;
    } else {
      const days = Math.floor(hours / 24);
      const remainingHours = hours % 24;
      return `${days}d ${remainingHours}h`;
    }
  };

  const handlePresetSelect = (hours: number | null) => {
    updateField("defaultTimeLimitHours", hours);
    // Clear custom date when preset is selected
    if (hours !== null) {
      setCustomDateTime("");
    }
  };

  const handleCustomDateChange = (dateTimeString: string) => {
    setCustomDateTime(dateTimeString);
    // Clear any errors when date is selected
    if (dateTimeString && errors.creationExpiry) {
      setErrors(prev => ({ ...prev, creationExpiry: "" }));
    }
  };

  const handleTimerModeChange = (mode: "verification" | "creation") => {
    updateField("timerMode", mode);
    
    // Reset timer settings when changing modes
    if (mode === "verification") {
      // Reset to preset for verification mode
      updateField("defaultTimeLimitHours", 24);
      setCustomDateTime("");
    } else {
      // Keep current settings for creation mode
      // Custom datetime will be available if they choose it
    }
  };

  const getAccessDescription = () => {
    if (formData.timerMode === "verification") {
      return "Recipients must verify their email first, then their personal timer starts counting down for the set duration.";
    } else {
      return "All recipients have the same deadline - timer starts immediately when drop is created.";
    }
  };

  const isCustomMode = formData.timerMode === "creation" && formData.defaultTimeLimitHours === null;

  // Get minimum datetime for the input (current time)
  const getMinDateTime = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
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
            Share files and links securely with flexible timer controls
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
                  className="grid grid-cols-1 md:grid-cols-2 gap-4"
                >
                  <div className={`flex items-center space-x-3 p-4 rounded-lg border-2 transition-colors cursor-pointer h-20 ${
                    formData.dropType === "url" 
                      ? "border-primary bg-primary/5" 
                      : "border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  }`}>
                    <RadioGroupItem value="url" id="url" />
                    <Label htmlFor="url" className="flex items-center cursor-pointer flex-1">
                      <Link2 className="w-5 h-5 mr-3 text-primary" />
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">URL</p>
                      </div>
                    </Label>
                  </div>
                  <div className={`flex items-center space-x-3 p-4 rounded-lg border-2 transition-colors cursor-pointer h-20 ${
                    formData.dropType === "file" 
                      ? "border-primary bg-primary/5" 
                      : "border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  }`}>
                    <RadioGroupItem value="file" id="file" />
                    <Label htmlFor="file" className="flex items-center cursor-pointer flex-1">
                      <FileUp className="w-5 h-5 mr-3 text-primary" />
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">File</p>
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
                <div className="flex items-center gap-2 mb-6">
                  <Clock className="w-5 h-5 text-primary" />
                  <h2 className="text-lg font-medium text-gray-900 dark:text-white">Access Settings</h2>
                </div>
                
                {/* Access Type Selection */}
                <div className="mb-6">
                  <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4 block">Access Type</Label>
                  <RadioGroup
                    value={formData.timerMode}
                    onValueChange={handleTimerModeChange}
                    className="grid grid-cols-1 md:grid-cols-2 gap-4"
                  >
                    <div className={`flex items-center space-x-3 p-4 rounded-lg border-2 transition-colors cursor-pointer h-20 ${
                      formData.timerMode === "verification" 
                        ? "border-primary bg-primary/5" 
                        : "border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                    }`}>
                      <RadioGroupItem value="verification" id="verification" />
                      <Label htmlFor="verification" className="flex items-center cursor-pointer flex-1">
                        <Timer className="w-5 h-5 mr-3 text-primary" />
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">After Verification</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">timer starts once verified</p>
                        </div>
                      </Label>
                    </div>
                    
                    <div className={`flex items-center space-x-3 p-4 rounded-lg border-2 transition-colors cursor-pointer h-20 ${
                      formData.timerMode === "creation" 
                        ? "border-primary bg-primary/5" 
                        : "border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                    }`}>
                      <RadioGroupItem value="creation" id="creation" />
                      <Label htmlFor="creation" className="flex items-center cursor-pointer flex-1">
                        <CalendarDays className="w-5 h-5 mr-3 text-primary" />
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">After Creation</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">timer starts once created</p>
                        </div>
                      </Label>
                    </div>
                  </RadioGroup>
                </div>

                {/* Duration Options */}
                <div className="mb-6">
                  <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 block">
                    Duration Options
                  </Label>
                  <div className={`grid gap-2 ${
                    formData.timerMode === "verification" 
                      ? "grid-cols-2 md:grid-cols-4" 
                      : "grid-cols-2 md:grid-cols-5"
                  }`}>
                    {[
                      { value: 1, label: "1 Hour" },
                      { value: 3, label: "3 Hours" },
                      { value: 12, label: "12 Hours" },
                      { value: 24, label: "24 Hours" }
                    ].map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => handlePresetSelect(option.value)}
                        className={`p-3 rounded-md border-2 transition-colors text-sm font-medium ${
                          formData.defaultTimeLimitHours === option.value
                            ? "border-primary bg-primary/5 text-primary" 
                            : "border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 text-gray-700 dark:text-gray-300"
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                    
                    {/* Custom option only for "After Creation" mode */}
                    {formData.timerMode === "creation" && (
                      <button
                        type="button"
                        onClick={() => handlePresetSelect(null)}
                        className={`p-3 rounded-md border-2 transition-colors text-sm font-medium ${
                          formData.defaultTimeLimitHours === null
                            ? "border-primary bg-primary/5 text-primary" 
                            : "border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 text-gray-700 dark:text-gray-300"
                        }`}
                      >
                        Custom
                      </button>
                    )}
                  </div>
                </div>

                {/* Custom DateTime Input - Only for Creation mode */}
                {isCustomMode && (
                  <div className="mb-6">
                    <Label htmlFor="customDateTime" className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                      Select Custom Date & Time
                    </Label>
                    <Input
                      id="customDateTime"
                      type="datetime-local"
                      value={customDateTime}
                      onChange={(e) => handleCustomDateChange(e.target.value)}
                      min={getMinDateTime()}
                      className={`${errors.creationExpiry ? "border-red-500 focus:ring-red-500" : ""}`}
                    />
                    {errors.creationExpiry && (
                      <p className="text-sm text-red-500 mt-2">{errors.creationExpiry}</p>
                    )}
                    {customDateTime && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                        Selected: {format(new Date(customDateTime), "MMM d, yyyy 'at' hh:mm aa")}
                      </p>
                    )}
                  </div>
                )}

                {/* Dynamic Description */}
                <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                  <div className="text-sm text-gray-600 dark:text-gray-400 bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
                    <p>{getAccessDescription()}</p>
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
                      <p className="font-medium text-gray-900 dark:text-white">
                        {formData.timerMode === "verification" ? "Send Verification Emails" : "Send Access Emails"}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {formData.timerMode === "verification" 
                          ? "Recipients must verify before accessing" 
                          : "Recipients get direct access links"}
                      </p>
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
                    <span className="text-gray-500 dark:text-gray-400">Access Type:</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {formData.timerMode === "verification" ? "After Verification" : "After Creation"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Duration:</span>
                    <span className="font-medium text-gray-900 dark:text-white">{getTimeLimitDisplay()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Mode:</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {isCustomMode ? "Custom" : "Preset"}
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