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
import { useState, useRef, useEffect } from "react";
import { FileUp, Link2, Shield, Users, Clock, Info, Loader2, Upload, X, CheckCircle, Timer, CalendarDays } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { useAuth } from "@/components/AuthProvider";
import { Navbar } from "@/components/Navbar";
import { format, addHours } from "date-fns";
import { useSubscription } from '@/components/SubscriptionProvider';
import { useFormLimitValidation } from '@/hooks/useSubscription';
import { AlertTriangle, Zap, Crown, Database, TrendingUp } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

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

// Add these components BEFORE your main DropForm function

function LimitValidationAlert({ 
  validationState, 
  onUpgrade 
}: { 
  validationState: any; 
  onUpgrade: () => void;
}) {
  if (validationState.isValid) return null;

  const upgradePrompt = validationState.upgradePrompt;
  const isHardBlock = upgradePrompt?.type === 'hard';

  return (
    <Alert className={`mb-4 ${isHardBlock ? 'border-red-500 bg-red-50 dark:bg-red-900/20' : 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20'}`}>
      <AlertTriangle className={`h-4 w-4 ${isHardBlock ? 'text-red-600' : 'text-yellow-600'}`} />
      <AlertDescription className="flex items-center justify-between">
        <div>
          <p className={`font-medium ${isHardBlock ? 'text-red-800 dark:text-red-200' : 'text-yellow-800 dark:text-yellow-200'}`}>
            {upgradePrompt?.title || 'Limit Exceeded'}
          </p>
          <p className={`text-sm mt-1 ${isHardBlock ? 'text-red-700 dark:text-red-300' : 'text-yellow-700 dark:text-yellow-300'}`}>
            {upgradePrompt?.description || validationState.errors[0]}
          </p>
        </div>
        <Button
          onClick={onUpgrade}
          size="sm"
          className={isHardBlock ? 'bg-red-600 hover:bg-red-700' : 'bg-yellow-600 hover:bg-yellow-700'}
        >
          <Crown className="w-4 h-4 mr-1" />
          {upgradePrompt?.cta || 'Upgrade'}
        </Button>
      </AlertDescription>
    </Alert>
  );
}

function UsageMeter({ 
  current, 
  limit, 
  label, 
  icon: Icon,
  color = 'blue'
}: {
  current: number;
  limit: number;
  label: string;
  icon: any;
  color?: 'blue' | 'yellow' | 'red' | 'purple' | 'green';
}) {
  if (limit === -1) {
    return (
      <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
        <Icon className="w-5 h-5 text-green-600" />
        <div className="flex-1">
          <p className="text-sm font-medium text-green-800 dark:text-green-200">{label}</p>
          <p className="text-xs text-green-600 dark:text-green-400">Unlimited</p>
        </div>
      </div>
    );
  }

  const percentage = Math.min((current / limit) * 100, 100);
  const isWarning = percentage >= 80;
  const isDanger = percentage >= 100;

  const colorClasses: Record<'blue' | 'yellow' | 'red' | 'purple' | 'green', string> = {
    blue: 'text-blue-600 bg-blue-50 border-blue-200',
    yellow: 'text-yellow-600 bg-yellow-50 border-yellow-200',
    red: 'text-red-600 bg-red-50 border-red-200',
    purple: 'text-purple-600 bg-purple-50 border-purple-200',
    green: 'text-green-600 bg-green-50 border-green-200'
  };

  const bgColor: 'blue' | 'yellow' | 'red' | 'purple' | 'green' = isDanger ? 'red' : isWarning ? 'yellow' : color;

  return (
    <div className={`p-3 rounded-lg border ${colorClasses[bgColor]} dark:bg-gray-800 dark:border-gray-600`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Icon className={`w-4 h-4 ${isDanger ? 'text-red-600' : isWarning ? 'text-yellow-600' : `text-${color}-600`}`} />
          <span className="text-sm font-medium">{label}</span>
        </div>
        <span className={`text-xs font-mono ${isDanger ? 'text-red-700' : isWarning ? 'text-yellow-700' : 'text-gray-600'}`}>
          {current}/{limit}
        </span>
      </div>
      <div className="space-y-1">
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
          <div 
            className={`h-2 rounded-full transition-all duration-300 ${
              isDanger ? 'bg-red-500' : isWarning ? 'bg-yellow-500' : `bg-${color}-500`
            }`}
            style={{ width: `${Math.min(percentage, 100)}%` }}
          />
        </div>
        <p className="text-xs text-gray-600 dark:text-gray-400">
          {Math.round(percentage)}% used
        </p>
      </div>
    </div>
  );
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
  // Add these after your existing useState declarations
  const { usageData, userTier } = useSubscription();
  const { validationState, validateLimits, clearValidation } = useFormLimitValidation();

  const updateField = (field: keyof FormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: "" }));
    }
  };

  // Add this useEffect for real-time validation
useEffect(() => {
  const validateInRealTime = async () => {
    if (!user?.id) return;

    const recipientEmails = formData.recipients
      .split(/[,\n]/)
      .map((email) => email.trim())
      .filter(Boolean);

    const fileSizeMb = formData.dropType === "file" && uploadedFile 
      ? uploadedFile.size / (1024 * 1024) 
      : 0;

    if (recipientEmails.length > 0 || fileSizeMb > 0) {
      await validateLimits({
        recipients: recipientEmails,
        fileSize: fileSizeMb
      });
    } else {
      clearValidation();
    }
  };

  // Debounce validation to avoid too many API calls
  const timeoutId = setTimeout(validateInRealTime, 500);
  return () => clearTimeout(timeoutId);
}, [formData.recipients, uploadedFile, user?.id, validateLimits, clearValidation]);

// Add upgrade handler
const handleUpgradeClick = () => {
  router.push('/settings');
};

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Name validation
    if (!formData.name.trim()) {
      newErrors.name = "Drop name is required";
    } else if (formData.name.trim().length < 3) {
      newErrors.name = "Drop name must be at least 3 characters";
    } else if (formData.name.trim().length > 100) {
      newErrors.name = "Drop name must be less than 100 characters";
    }

    // URL validation for URL drops
    if (formData.dropType === "url") {
      if (!formData.maskedUrl.trim()) {
        newErrors.maskedUrl = "URL is required";
      } else {
        try {
          new URL(formData.maskedUrl.trim());
        } catch {
          newErrors.maskedUrl = "Please enter a valid URL";
        }
      }
    }

    // File validation for file drops
    if (formData.dropType === "file" && !uploadedFile) {
      newErrors.file = "Please select a file to upload";
    }

    // Recipients validation (if provided)
    if (formData.recipients.trim()) {
      const emails = formData.recipients
        .split(/[,\n]/)
        .map((email) => email.trim())
        .filter(Boolean);

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const invalidEmails = emails.filter((email) => !emailRegex.test(email));

      if (invalidEmails.length > 0) {
        newErrors.recipients = `Invalid email(s): ${invalidEmails.join(", ")}`;
      }
    }

    // Timer validation
    if (formData.timerMode === "creation") {
      if (formData.defaultTimeLimitHours === null) {
        // Custom mode
        if (!customDateTime) {
          newErrors.creationExpiry = "Please select an expiry date and time";
        } else {
          const selectedDate = new Date(customDateTime);
          if (selectedDate <= new Date()) {
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

  // Updated handleSubmit function that uses the protected API
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
    let createdDrop: any = null;
    
    try {
      // First, ensure the user exists in the users table
      const userExists = await ensureUserExists();
      if (!userExists) {
        throw new Error("Failed to create or verify user account");
      }

      // Calculate file size for limit checking (but don't upload yet)
      let fileSizeMb: number = 0;
      if (formData.dropType === "file" && uploadedFile) {
        fileSizeMb = uploadedFile.size / (1024 * 1024);
      }

      // Calculate expiry dates
      const expiryDate = getExpiryDate();

      // Prepare API request payload (without file path initially)
      const createDropPayload = {
        userId: user.id,
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        dropType: formData.dropType,
        maskedUrl: formData.dropType === "url" ? formData.maskedUrl.trim() : null,
        recipients: formData.recipients,
        timerMode: formData.timerMode,
        defaultTimeLimitHours: formData.timerMode === "verification" ? formData.defaultTimeLimitHours : null,
        verificationDeadline: formData.timerMode === "verification" && formData.verificationDeadline 
          ? formData.verificationDeadline.toISOString() 
          : null,
        creationExpiry: expiryDate?.toISOString() || null,
        filePath: null, // Will be updated after file upload
        fileSizeMb: fileSizeMb
      };

      console.log("🚀 Calling protected drop creation API...");

      // Call the protected API route
      const response = await fetch('/api/drops/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(createDropPayload)
      });

      const result = await response.json();

      // Handle subscription limit errors
      if (!response.ok) {
        if (response.status === 403 && result.upgrade_required) {
          // Show upgrade prompt for subscription limits
          console.log("❌ Subscription limit hit:", result.error);
          
          if (result.upgrade_prompt) {
            // You can customize this to show a modal or redirect to upgrade page
            const upgradeChoice = confirm(
              `${result.upgrade_prompt.title}\n\n${result.upgrade_prompt.description}\n\nWould you like to upgrade now?`
            );
            
            if (upgradeChoice) {
              router.push('/settings');
              return;
            }
          }
          
          toast.error(result.error || 'Subscription limit reached');
          return;
        }
        
        // Handle other API errors
        throw new Error(result.error || 'Failed to create drop');
      }

      createdDrop = result.drop;
      console.log("✅ Drop created successfully via API:", createdDrop.id);

      // Now handle file upload with the real drop ID (using your existing logic)
      if (formData.dropType === "file" && uploadedFile) {
        try {
          console.log("Starting file upload with real drop ID...");
          
          // Use your existing file upload logic
          const fileExt = uploadedFile.name.split('.').pop() ?? 'bin';
          const timestamp = Date.now();
          const randomPortion = Math.random().toString(36).substring(2, 10);
          const fileName = `${timestamp}_${randomPortion}.${fileExt}`;
          const filePath = `${user.id}/${createdDrop.id}/${fileName}`;
          
          console.log("Uploading file to path:", filePath);
          
          const { error: uploadError, data: uploadData } = await supabase.storage
            .from("drops")
            .upload(filePath, uploadedFile, {
              cacheControl: '3600',
              upsert: false
            });

          if (uploadError) {
            console.error("File upload error:", uploadError);
            throw uploadError;
          }
          
          console.log("File uploaded successfully:", uploadData);

          // Update the drop with the file path
          const { error: updateError } = await supabase
            .from("drops")
            .update({ file_path: filePath })
            .eq("id", createdDrop.id)
            .eq("owner_id", user.id);

          if (updateError) {
            console.error("Error updating drop with file path:", updateError);
            throw updateError;
          }
          
          console.log("✅ Drop updated with file path successfully");
        } catch (fileError) {
          console.error("File upload failed after drop creation:", fileError);
          
          // Clean up the created drop since file upload failed
          try {
            await supabase.from("drops").delete().eq("id", createdDrop.id).eq("owner_id", user.id);
            console.log("Cleaned up drop after file upload failure");
          } catch (cleanupError) {
            console.error("Failed to clean up drop:", cleanupError);
          }
          
          throw new Error(`File upload failed: ${(fileError as Error).message || 'Unknown error'}`);
        }
      }

      // Process recipients for email notifications
      const recipientEmails = formData.recipients
        .split(/[,\n]/)
        .map((email) => email.trim())
        .filter((email) => email.length > 0);

      // Send email notifications if enabled and recipients exist
      if (formData.sendNotifications && recipientEmails.length > 0) {
        try {
          console.log("Sending email notifications to recipients...");
          
          // Get creator's display name from user profile
          const { data: userProfile, error: profileError } = await supabase
            .from('users')
            .select('display_name')
            .eq('id', user.id)
            .single();
          
          const creatorDisplayName = userProfile?.display_name || user.email?.split('@')[0] || 'Someone';
          
          const emailResponse = await fetch('/api/send-drop-notification', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              dropId: createdDrop.id,
              recipientEmails: recipientEmails,
              dropData: createdDrop,
              creatorEmail: user.email || 'Unknown User',
              creatorDisplayName: creatorDisplayName
            }),
          });

          if (!emailResponse.ok) {
            console.error('Email notification failed');
            toast.error('Drop created but failed to send email notifications');
          } else {
            console.log("✅ Email notifications sent successfully");
          }
        } catch (emailError) {
          console.error('Error sending email notifications:', emailError);
          toast.error('Drop created but failed to send email notifications');
        }
      }

      // Show success message
      if (recipientEmails.length > 0) {
        if (formData.sendNotifications) {
          const successMessage = formData.timerMode === "verification" 
            ? "Drop created and notifications sent! Recipients will receive email access links."
            : "Drop created and notifications sent! Recipients will receive email access links.";
          toast.success(successMessage);
        } else {
          const successMessage = formData.timerMode === "verification" 
            ? "Drop created! Share the link manually with recipients."
            : "Drop created! Share the link manually with recipients.";
          toast.success(successMessage);
        }
      } else {
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
      
      // Navigate to manage page
      router.push(`/drops/${createdDrop.id}/manage`);

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
    if (file) {
      handleFileSelection(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelection(files[0]);
    }
  };

  const removeFile = () => {
    setUploadedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const getTimerDescription = () => {
    if (formData.timerMode === "verification") {
      if (formData.defaultTimeLimitHours === null) {
        return "Recipients will have custom time limits set individually.";
      } else {
        const hours = formData.defaultTimeLimitHours;
        const timeString = hours < 24 
          ? `${hours} hour${hours !== 1 ? 's' : ''}` 
          : `${Math.floor(hours / 24)} day${Math.floor(hours / 24) !== 1 ? 's' : ''}`;
        return `Recipients will have ${timeString} to access after email verification.`;
      }
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
          {/* Add this right after <form onSubmit={handleSubmit}> */}
<LimitValidationAlert 
  validationState={validationState}
  onUpgrade={handleUpgradeClick}
/>
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
                      className={errors.name ? "border-red-500 focus:border-red-500" : ""}
                    />
                    {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
                  </div>

                  <div>
                    <Label htmlFor="description" className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">
                      Description (Optional)
                    </Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => updateField("description", e.target.value)}
                      placeholder="Brief description of what you're sharing..."
                      rows={3}
                      className={errors.description ? "border-red-500 focus:border-red-500" : ""}
                    />
                    {errors.description && <p className="text-red-500 text-sm mt-1">{errors.description}</p>}
                  </div>
                </div>
              </div>

              {/* Content Type Selection */}
              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-2 mb-4">
                  <Upload className="w-5 h-5 text-primary" />
                  <h2 className="text-lg font-medium text-gray-900 dark:text-white">Content Type</h2>
                </div>

                <RadioGroup
                  value={formData.dropType}
                  onValueChange={(value) => updateField("dropType", value as "file" | "url")}
                  className="grid grid-cols-2 gap-4"
                >
                  <div className="relative">
                    <RadioGroupItem value="url" id="url" className="peer sr-only" />
                    <Label
                      htmlFor="url"
                      className="flex flex-col items-center justify-center rounded-lg border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 hover:bg-gray-50 dark:hover:bg-gray-700 peer-data-[state=checked]:border-primary peer-data-[state=checked]:text-primary cursor-pointer transition-all"
                    >
                      <Link2 className="w-6 h-6 mb-2" />
                      <span className="font-medium">Mask URL</span>
                      <span className="text-sm text-gray-500 dark:text-gray-400 text-center">
                        Hide and protect any web link
                      </span>
                    </Label>
                  </div>
                  <div className="relative">
                    <RadioGroupItem value="file" id="file" className="peer sr-only" />
                    <Label
                      htmlFor="file"
                      className="flex flex-col items-center justify-center rounded-lg border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 hover:bg-gray-50 dark:hover:bg-gray-700 peer-data-[state=checked]:border-primary peer-data-[state=checked]:text-primary cursor-pointer transition-all"
                    >
                      <FileUp className="w-6 h-6 mb-2" />
                      <span className="font-medium">Upload File</span>
                      <span className="text-sm text-gray-500 dark:text-gray-400 text-center">
                        Share files securely
                      </span>
                    </Label>
                  </div>
                </RadioGroup>

                {/* URL Input */}
                {formData.dropType === "url" && (
                  <div className="mt-4">
                    <Label htmlFor="maskedUrl" className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">
                      URL to Mask <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="maskedUrl"
                      type="url"
                      value={formData.maskedUrl}
                      onChange={(e) => updateField("maskedUrl", e.target.value)}
                      placeholder="https://example.com/your-link"
                      className={errors.maskedUrl ? "border-red-500 focus:border-red-500" : ""}
                    />
                    {errors.maskedUrl && <p className="text-red-500 text-sm mt-1">{errors.maskedUrl}</p>}
                  </div>
                )}

                {/* File Upload */}
                {formData.dropType === "file" && (
                  <div className="mt-4">
                    <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">
                      File Upload <span className="text-red-500">*</span>
                    </Label>
                    
                    {!uploadedFile ? (
                      <div
                        className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                          isDragOver 
                            ? "border-primary bg-primary/5" 
                            : errors.file 
                            ? "border-red-500" 
                            : "border-gray-300 dark:border-gray-600"
                        }`}
                        onDrop={handleDrop}
                        onDragOver={(e) => {
                          e.preventDefault();
                          setIsDragOver(true);
                        }}
                        onDragLeave={() => setIsDragOver(false)}
                      >
                        <FileUp className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                        <p className="text-gray-600 dark:text-gray-400 mb-2">
                          Drag and drop your file here, or{" "}
                          <Button
                            type="button"
                            variant="link"
                            className="p-0 h-auto font-medium text-primary"
                            onClick={() => fileInputRef.current?.click()}
                          >
                            browse files
                          </Button>
                        </p>
                        <p className="text-xs text-gray-500">Maximum file size: 100MB</p>
                        <input
                          ref={fileInputRef}
                          type="file"
                          onChange={handleFileChange}
                          className="hidden"
                          accept="*/*"
                        />
                      </div>
                    ) : (
                      <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                        <div className="flex items-center gap-3">
                          <CheckCircle className="w-5 h-5 text-green-600" />
                          <div>
                            <p className="text-sm font-medium text-green-800 dark:text-green-200">
                              {uploadedFile.name}
                            </p>
                            <p className="text-xs text-green-600 dark:text-green-400">
                              {(uploadedFile.size / (1024 * 1024)).toFixed(1)} MB
                            </p>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={removeFile}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                    {errors.file && <p className="text-red-500 text-sm mt-1">{errors.file}</p>}
                  </div>
                )}
              </div>

              {/* Recipients */}
              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-2 mb-4">
                  <Users className="w-5 h-5 text-primary" />
                  <h2 className="text-lg font-medium text-gray-900 dark:text-white">Recipients</h2>
                </div>

                <div>
                  <Label htmlFor="recipients" className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">
                    Email Addresses (Optional)
                  </Label>
                  <Textarea
                    id="recipients"
                    value={formData.recipients}
                    onChange={(e) => updateField("recipients", e.target.value)}
                    placeholder="email1@example.com, email2@example.com&#10;Or one email per line..."
                    rows={3}
                    className={errors.recipients ? "border-red-500 focus:border-red-500" : ""}
                  />
                  {errors.recipients && <p className="text-red-500 text-sm mt-1">{errors.recipients}</p>}
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Separate multiple emails with commas or new lines. Leave empty to share manually.
                  </p>
                </div>
              </div>

              {/* Timer Configuration */}
              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-2 mb-4">
                  <Clock className="w-5 h-5 text-primary" />
                  <h2 className="text-lg font-medium text-gray-900 dark:text-white">Timer Configuration</h2>
                </div>

                <div className="space-y-4">
                  {/* Timer Mode Selection */}
                  <div>
                    <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 block">
                      Timer Mode
                    </Label>
                    <RadioGroup
                      value={formData.timerMode}
                      onValueChange={(value) => updateField("timerMode", value as "verification" | "creation")}
                      className="grid grid-cols-1 md:grid-cols-2 gap-4"
                    >
                      <div className="relative">
                        <RadioGroupItem value="verification" id="verification" className="peer sr-only" />
                        <Label
                          htmlFor="verification"
                          className="flex items-center space-x-3 rounded-lg border-2 border-gray-200 dark:border-gray-700 p-4 hover:bg-gray-50 dark:hover:bg-gray-700 peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 cursor-pointer transition-all"
                        >
                          <Timer className="w-5 h-5 text-primary" />
                          <div>
                            <div className="font-medium text-gray-900 dark:text-white">After Email Verification</div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">Timer starts when recipient verifies their email</div>
                          </div>
                        </Label>
                      </div>
                      <div className="relative">
                        <RadioGroupItem value="creation" id="creation" className="peer sr-only" />
                        <Label
                          htmlFor="creation"
                          className="flex items-center space-x-3 rounded-lg border-2 border-gray-200 dark:border-gray-700 p-4 hover:bg-gray-50 dark:hover:bg-gray-700 peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 cursor-pointer transition-all"
                        >
                          <CalendarDays className="w-5 h-5 text-primary" />
                          <div>
                            <div className="font-medium text-gray-900 dark:text-white">Fixed Expiry Date</div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">Set a specific deadline for all recipients</div>
                          </div>
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>

                  {/* Timer Configuration Based on Mode */}
                  {formData.timerMode === "verification" && (
                    <div>
                      <Label htmlFor="defaultTimeLimitHours" className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">
                        Time Limit After Verification
                      </Label>
                      <select
                        id="defaultTimeLimitHours"
                        value={formData.defaultTimeLimitHours || ""}
                        onChange={(e) => updateField("defaultTimeLimitHours", e.target.value ? parseInt(e.target.value) : null)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      >
                        <option value="1">1 hour</option>
                        <option value="3">3 hours</option>
                        <option value="6">6 hours</option>
                        <option value="12">12 hours</option>
                        <option value="24">24 hours</option>
                        <option value="48">2 days</option>
                        <option value="72">3 days</option>
                        <option value="168">1 week</option>
                      </select>
                      {formData.verificationDeadline && (
                        <div className="mt-2">
                          <Label htmlFor="verificationDeadline" className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">
                            Verification Deadline
                          </Label>
                          <Input
                            id="verificationDeadline"
                            type="datetime-local"
                            value={formData.verificationDeadline ? format(formData.verificationDeadline, "yyyy-MM-dd'T'HH:mm") : ""}
                            onChange={(e) => updateField("verificationDeadline", e.target.value ? new Date(e.target.value) : undefined)}
                            min={getMinDateTime()}
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {formData.timerMode === "creation" && (
                    <div>
                      <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 block">
                        Expiry Configuration
                      </Label>
                      <RadioGroup
                        value={formData.defaultTimeLimitHours === null ? "custom" : "preset"}
                        onValueChange={(value) => {
                          if (value === "custom") {
                            updateField("defaultTimeLimitHours", null);
                          } else {
                            updateField("defaultTimeLimitHours", 24);
                          }
                        }}
                        className="space-y-3"
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="preset" id="preset" />
                          <Label htmlFor="preset" className="text-sm text-gray-700 dark:text-gray-300">
                            Preset duration from now
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="custom" id="custom" />
                          <Label htmlFor="custom" className="text-sm text-gray-700 dark:text-gray-300">
                            Custom date and time
                          </Label>
                        </div>
                      </RadioGroup>

                      {!isCustomMode && (
                        <div className="mt-3">
                          <select
                            value={formData.defaultTimeLimitHours || 24}
                            onChange={(e) => updateField("defaultTimeLimitHours", parseInt(e.target.value))}
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          >
                            <option value="1">1 hour from now</option>
                            <option value="3">3 hours from now</option>
                            <option value="6">6 hours from now</option>
                            <option value="12">12 hours from now</option>
                            <option value="24">24 hours from now</option>
                            <option value="48">2 days from now</option>
                            <option value="72">3 days from now</option>
                            <option value="168">1 week from now</option>
                          </select>
                          {errors.defaultTimeLimitHours && (
                            <p className="text-red-500 text-sm mt-1">{errors.defaultTimeLimitHours}</p>
                          )}
                        </div>
                      )}

                      {isCustomMode && (
                        <div className="mt-3">
                          <Input
                            type="datetime-local"
                            value={customDateTime}
                            onChange={(e) => setCustomDateTime(e.target.value)}
                            min={getMinDateTime()}
                            className={errors.creationExpiry ? "border-red-500 focus:border-red-500" : ""}
                          />
                          {errors.creationExpiry && (
                            <p className="text-red-500 text-sm mt-1">{errors.creationExpiry}</p>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Timer Description */}
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                    <p className="text-sm text-blue-800 dark:text-blue-200">
                      <Info className="w-4 h-4 inline mr-1" />
                      {getTimerDescription()}
                    </p>
                  </div>
                </div>
              </div>

              {/* Email Notifications */}
              {formData.recipients.trim() && (
                <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Users className="w-5 h-5 text-primary" />
                      <h2 className="text-lg font-medium text-gray-900 dark:text-white">Email Notifications</h2>
                    </div>
                    <Switch
                      checked={formData.sendNotifications}
                      onCheckedChange={(checked) => updateField("sendNotifications", checked)}
                    />
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                    Send email notifications to recipients with secure access links
                  </p>
                </div>
              )}
            </div>

            {/* Right Column - Summary */}
            <div className="lg:col-span-1">
              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 sticky top-6">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Drop Summary</h3>
                
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Type:</span>
                    <span className="font-medium text-gray-900 dark:text-white capitalize">
                      {formData.dropType === "file" ? "File Upload" : "URL Masking"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Timer Mode:</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {formData.timerMode === "verification" ? "After Verification" : "Fixed Deadline"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Recipients:</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {formData.recipients.trim() 
                        ? formData.recipients.split(/[,\n]/).filter(email => email.trim()).length
                        : 0
                      }
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Notifications:</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {formData.sendNotifications ? "Enabled" : "Disabled"}
                    </span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col gap-3 mt-6">
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
          </div>
        </form>
      </div>
    </div>
  );
}