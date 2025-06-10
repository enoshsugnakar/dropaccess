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
import {
  FileUp,
  Link2,
  Shield,
  Users,
  Clock,
  Info,
  Loader2,
  Upload,
  X,
  CheckCircle,
  Timer,
  CalendarDays,
  Crown,
  AlertCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { useAuth } from "@/components/AuthProvider";
import { useSubscription } from "@/hooks/use-subscription";
import { format, addHours } from "date-fns";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "./ui/badge";

interface FormData {
  name: string;
  description: string;
  dropType: "file" | "url";
  maskedUrl: string;
  recipients: string;
  timerMode: "verification" | "creation";
  defaultTimeLimitHours: number | null;
  sendNotifications: boolean;
}

/**
 * DropForm
 *  - Form for creating a new drop with file upload or URL masking
 *  - Allows specifying recipients, access duration, and other options
 */
export function DropForm() {
  const router = useRouter();
  const { user } = useAuth();
  // Use the 'loading' property instead of 'isLoading' to avoid the TS error
  const { planLimits, usage, loading: planLoading } = useSubscription();
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
    sendNotifications: true,
  });

  // Redirect if not authenticated
  useEffect(() => {
    if (!user) {
      router.push("/auth");
    }
  }, [user, router]);

  const updateField = (field: keyof FormData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  const getMaxFileSize = () => {
    if (!planLimits) return 10; // Default for free
    return planLimits.max_file_size_mb;
  };

  const getMaxRecipients = () => {
    if (!planLimits) return 3; // Default for free
    return planLimits.max_recipients_per_drop;
  };

  const canUseTimerMode = (mode: string) => {
    // If we have no planLimits, assume free plan: only "creation" is allowed
    if (!planLimits) return mode === "creation";
    if (mode === "verification") {
      return planLimits.time_starts_after_verification;
    }
    return true;
  };

  const getMaxAccessTime = () => {
    // For free plan with no planLimits, let's allow up to 3 hours
    if (!planLimits) return { hours: 3, days: 0 };

    if (planLimits.max_access_hours) {
      return { hours: planLimits.max_access_hours, days: 0 };
    }
    if (planLimits.max_access_days) {
      return { hours: 0, days: planLimits.max_access_days };
    }
    // Fallback if something's missing
    return { hours: 24, days: 1 };
  };

  const getAvailableTimeOptions = () => {
    const maxTime = getMaxAccessTime();
    const maxHours = maxTime.days * 24 + maxTime.hours;

    // Some possible increments. Adjust as needed.
    const allOptions = [
      { value: 1, label: "1 hour" },
      { value: 3, label: "3 hours" },
      { value: 6, label: "6 hours" },
      { value: 12, label: "12 hours" },
      { value: 24, label: "24 hours (1 day)" },
      { value: 48, label: "48 hours (2 days)" },
      { value: 72, label: "72 hours (3 days)" },
      { value: 168, label: "168 hours (7 days)" },
    ];

    // Filter by plan's maxHours
    return allOptions.filter((option) => option.value <= maxHours);
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = "Drop name is required";
    }

    if (formData.dropType === "url" && !formData.maskedUrl.trim()) {
      newErrors.maskedUrl = "URL is required";
    }

    if (formData.dropType === "file" && !uploadedFile) {
      newErrors.file = "Please upload a file";
    }

    if (!formData.recipients.trim()) {
      newErrors.recipients = "At least one recipient email is required";
    }

    // Validate recipient emails
    const emails = formData.recipients
      .split(/[,\n]/)
      .map((e) => e.trim())
      .filter((e) => e);
    const invalidEmails = emails.filter((email) => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return !emailRegex.test(email);
    });
    if (invalidEmails.length > 0) {
      newErrors.recipients = `Invalid email(s): ${invalidEmails.join(", ")}`;
    }

    // Check recipient limit
    const maxRecipients = getMaxRecipients();
    if (emails.length > maxRecipients) {
      newErrors.recipients = `You can only add up to ${maxRecipients} recipients on your current plan`;
    }

    // Validate time for creation mode
    if (formData.timerMode === "creation") {
      if (formData.defaultTimeLimitHours === null && !customDateTime) {
        newErrors.timeLimit = "Please set an expiry time or use a pre-defined duration";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error("Please sign in to create a drop");
      router.push("/auth");
      return;
    }

    if (!validateForm()) {
      toast.error("Please fix the errors in the form");
      return;
    }

    setIsSubmitting(true);

    try {
      let fileUrl = null;

      // Upload the file if needed
      if (formData.dropType === "file" && uploadedFile) {
        const fileExt = uploadedFile.name.split(".").pop();
        const fileName = `${user.id}/${Date.now()}-${Math.random()
          .toString(36)
          .substring(7)}.${fileExt}`;

        // "drop-files" bucket; adjust if your storage name differs
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("drop-files")
          .upload(fileName, uploadedFile);

        if (uploadError) throw uploadError;
        fileUrl = uploadData?.path || null;
      }

      // Calculate expiry
      let expiresAt = null;
      let defaultTimeLimitHours = null;
      if (formData.timerMode === "creation") {
        if (formData.defaultTimeLimitHours !== null) {
          expiresAt = addHours(new Date(), formData.defaultTimeLimitHours).toISOString();
        } else if (customDateTime) {
          expiresAt = new Date(customDateTime).toISOString();
        }
      } else {
        // verification mode
        defaultTimeLimitHours = formData.defaultTimeLimitHours;
      }

      // Insert drop
      const { data: drop, error: dropError } = await supabase
        .from("drops")
        .insert({
          owner_id: user.id,
          name: formData.name,
          description: formData.description || null,
          drop_type: formData.dropType,
          file_path: fileUrl,
          masked_url: formData.dropType === "url" ? formData.maskedUrl : null,
          expires_at: expiresAt,
          default_time_limit_hours: defaultTimeLimitHours, // only relevant in verification mode
          is_active: true,
          one_time_access: false,
        })
        .select()
        .single();

      if (dropError) throw dropError;

      // Process recipients
      const emails = formData.recipients
        .split(/[,\n]/)
        .map((email) => email.trim())
        .filter((email) => email.length > 0);

      // Create recipient records
      const recipientData = emails.map((email) => ({
        drop_id: drop.id,
        email: email.toLowerCase(),
        access_token: Math.random().toString(36).substring(2, 15),
      }));

      const { error: recipientError } = await supabase
        .from("drop_recipients")
        .insert(recipientData);
      if (recipientError) throw recipientError;

      // Send notifications if enabled
      if (formData.sendNotifications) {
        try {
          const response = await fetch("/api/send-notifications", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              dropId: drop.id,
              dropName: formData.name,
              recipients: emails,
              expiresAt,
              timerMode: formData.timerMode,
            }),
          });

          if (!response.ok) {
            console.error("Failed to send notifications");
            toast.error("Drop created but failed to send some notifications");
          }
        } catch (err) {
          console.error("Notification error:", err);
        }
      }

      const successMessage =
        formData.timerMode === "verification"
          ? "Drop created! Recipients will receive verification emails."
          : "Drop created! Recipients can access immediately.";

      toast.success(successMessage);
      router.push(`/drops/${drop.id}/manage`);
    } catch (err: any) {
      console.error("Error creating drop:", err);
      toast.error(err.message || "Failed to create drop");
    } finally {
      setIsSubmitting(false);
    }
  };

  // File selection logic
  const handleFileSelection = (file: File) => {
    const maxSizeMB = getMaxFileSize();
    const maxSizeBytes = maxSizeMB * 1024 * 1024;

    if (file.size > maxSizeBytes) {
      toast.error(`File size must be less than ${maxSizeMB}MB on your current plan`);
      return;
    }

    setUploadedFile(file);
    if (errors.file) {
      setErrors((prev) => ({ ...prev, file: "" }));
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
      .map((email) => email.trim())
      .filter((email) => email.length > 0).length;
  };

  const getTimeLimitDisplay = () => {
    if (formData.timerMode === "creation" && formData.defaultTimeLimitHours === null) {
      return customDateTime
        ? format(new Date(customDateTime), "MMM d, yyyy 'at' hh:mm aa")
        : "Custom - Not set";
    }

    const hours = formData.defaultTimeLimitHours;
    if (!hours) return "Not set";
    if (hours < 24) {
      return `${hours} hour${hours !== 1 ? "s" : ""}`;
    } else if (hours % 24 === 0) {
      const days = hours / 24;
      return `${days} day${days !== 1 ? "s" : ""}`;
    } else {
      const days = Math.floor(hours / 24);
      const remainingHours = hours % 24;
      return `${days} day${days !== 1 ? "s" : ""}, ${remainingHours} hour${
        remainingHours !== 1 ? "s" : ""
      }`;
    }
  };

  if (!user || planLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  const isPaidUser = planLimits?.plan_name !== "free";

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 py-8">
      <div className="container mx-auto px-4 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Create a New Drop
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Share files or URLs securely with time-based access control
          </p>
        </div>

        {/* Plan Limits Alert */}
        {planLimits && (
          <Alert className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <span className="font-medium">
                {planLimits.plan_name === "free"
                  ? "Free"
                  : planLimits.plan_name}{" "}
                plan:
              </span>{" "}
              {getMaxRecipients()} recipients, {getMaxFileSize()}MB files,
              {planLimits.plan_name === "free"
                ? " up to 1-3 hour"
                : ` up to ${
                    getMaxAccessTime().days
                      ? `${getMaxAccessTime().days} day`
                      : `${getMaxAccessTime().hours} hour`
                  }`}{" "}
              access
              {!isPaidUser && (
                <Button
                  variant="link"
                  className="ml-2 p-0 h-auto"
                  onClick={() => router.push("/pricing")}
                >
                  <Crown className="w-3 h-3 mr-1" />
                  Upgrade
                </Button>
              )}
            </AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-primary" />
                Basic Information
              </CardTitle>
              <CardDescription>
                Give your drop a name and optional description
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="name">Drop Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => updateField("name", e.target.value)}
                  placeholder="e.g., Q4 Report, Project Files"
                  className={errors.name ? "border-red-500" : ""}
                />
                {errors.name && (
                  <p className="text-sm text-red-500 mt-1">{errors.name}</p>
                )}
              </div>

              <div>
                <Label htmlFor="description">Description (Optional)</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => updateField("description", e.target.value)}
                  placeholder="Add any additional context or instructions..."
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          {/* Content Type */}
          <Card>
            <CardHeader>
              <CardTitle>Content Type</CardTitle>
              <CardDescription>Choose what you want to share</CardDescription>
            </CardHeader>
            <CardContent>
              <RadioGroup
                value={formData.dropType}
                onValueChange={handleDropTypeChange}
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <label
                    htmlFor="url"
                    className={`flex flex-col items-center space-y-3 border-2 rounded-lg p-6 cursor-pointer transition-all ${
                      formData.dropType === "url"
                        ? "border-primary bg-primary/5"
                        : "border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600"
                    }`}
                  >
                    <RadioGroupItem value="url" id="url" className="sr-only" />
                    <Link2 className="w-8 h-8 text-primary" />
                    <div className="text-center">
                      <p className="font-medium">URL/Link</p>
                      <p className="text-sm text-gray-500 mt-1">
                        Mask any URL or web resource
                      </p>
                    </div>
                  </label>

                  <label
                    htmlFor="file"
                    className={`flex flex-col items-center space-y-3 border-2 rounded-lg p-6 cursor-pointer transition-all ${
                      formData.dropType === "file"
                        ? "border-primary bg-primary/5"
                        : "border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600"
                    }`}
                  >
                    <RadioGroupItem value="file" id="file" className="sr-only" />
                    <FileUp className="w-8 h-8 text-primary" />
                    <div className="text-center">
                      <p className="font-medium">File Upload</p>
                      <p className="text-sm text-gray-500 mt-1">
                        Upload and share files securely
                      </p>
                    </div>
                  </label>
                </div>
              </RadioGroup>

              {/* URL Input */}
              {formData.dropType === "url" && (
                <div className="mt-6">
                  <Label htmlFor="maskedUrl">URL to Mask *</Label>
                  <Input
                    id="maskedUrl"
                    type="url"
                    value={formData.maskedUrl}
                    onChange={(e) => updateField("maskedUrl", e.target.value)}
                    placeholder="https://example.com/resource"
                    className={
                      errors.maskedUrl ? "border-red-500 mt-1" : "mt-1"
                    }
                  />
                  {errors.maskedUrl && (
                    <p className="text-sm text-red-500 mt-1">
                      {errors.maskedUrl}
                    </p>
                  )}
                  <p className="text-sm text-gray-500 mt-2">
                    The actual URL will be hidden behind a DropAccess link
                  </p>
                </div>
              )}

              {/* File Upload */}
              {formData.dropType === "file" && (
                <div className="mt-6">
                  <Label>Upload File * (Max: {getMaxFileSize()}MB)</Label>
                  <div
                    className={`mt-2 border-2 border-dashed rounded-lg p-8 text-center transition-all ${
                      isDragOver
                        ? "border-primary bg-primary/5"
                        : errors.file
                        ? "border-red-500 bg-red-50"
                        : "border-gray-300 hover:border-gray-400 dark:border-gray-600 dark:hover:border-gray-500"
                    }`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      onChange={handleFileChange}
                      className="hidden"
                      accept="*/*"
                    />

                    {uploadedFile ? (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                            <FileUp className="w-5 h-5 text-primary" />
                          </div>
                          <div className="text-left">
                            <p className="font-medium">{uploadedFile.name}</p>
                            <p className="text-sm text-gray-500">
                              {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB
                            </p>
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={removeFile}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ) : (
                      <div>
                        <Upload className="w-10 h-10 mx-auto mb-3 text-gray-400" />
                        <p className="text-gray-600 dark:text-gray-400 mb-2">
                          Drag and drop your file here, or
                        </p>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={openFileDialog}
                        >
                          Browse Files
                        </Button>
                        <p className="text-sm text-gray-500 mt-2">
                          Maximum file size: {getMaxFileSize()}MB
                        </p>
                      </div>
                    )}
                  </div>
                  {errors.file && (
                    <p className="text-sm text-red-500 mt-1">{errors.file}</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recipients */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                Recipients
              </CardTitle>
              <CardDescription>
                Specify who can access this drop (Max: {getMaxRecipients()})
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="recipients">Email Addresses *</Label>
                <Textarea
                  id="recipients"
                  value={formData.recipients}
                  onChange={(e) => updateField("recipients", e.target.value)}
                  placeholder={`Enter email addresses separated by commas or new lines
e.g., john@example.com, jane@example.com`}
                  rows={4}
                  className={
                    errors.recipients ? "border-red-500 mt-1" : "mt-1"
                  }
                />
                {errors.recipients && (
                  <p className="text-sm text-red-500 mt-1">
                    {errors.recipients}
                  </p>
                )}
                <div className="flex items-center justify-between mt-2">
                  <p className="text-sm text-gray-500">
                    {getRecipientCount()} / {getMaxRecipients()} recipient(s)
                  </p>
                  {!isPaidUser &&
                    getRecipientCount() >= getMaxRecipients() && (
                      <Button
                        type="button"
                        variant="link"
                        size="sm"
                        className="text-xs"
                        onClick={() => router.push("/pricing")}
                      >
                        <Crown className="w-3 h-3 mr-1" />
                        Need more?
                      </Button>
                    )}
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="notifications"
                  checked={formData.sendNotifications}
                  onCheckedChange={(checked) =>
                    updateField("sendNotifications", checked)
                  }
                />
                <Label htmlFor="notifications" className="cursor-pointer">
                  Send email notifications to recipients
                </Label>
              </div>
            </CardContent>
          </Card>

          {/* Access Control */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-primary" />
                Access Control
              </CardTitle>
              <CardDescription>
                Set when and how long recipients can access this drop
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label className="mb-3 block">Timer Mode</Label>
                <RadioGroup
                  value={formData.timerMode}
                  onValueChange={(value: "verification" | "creation") => {
                    if (!canUseTimerMode(value)) {
                      toast.error(
                        "This timer mode is only available for paid plans"
                      );
                      return;
                    }
                    updateField("timerMode", value);
                  }}
                >
                  <div className="space-y-3">
                    <label
                      htmlFor="verification"
                      className={`flex items-start space-x-3 border rounded-lg p-4 cursor-pointer transition-all ${
                        formData.timerMode === "verification"
                          ? "border-primary bg-primary/5"
                          : "border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600"
                      } ${
                        !canUseTimerMode("verification")
                          ? "opacity-50 cursor-not-allowed"
                          : ""
                      }`}
                    >
                      <RadioGroupItem
                        value="verification"
                        id="verification"
                        className="mt-1"
                        disabled={!canUseTimerMode("verification")}
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Timer className="w-4 h-4 text-primary" />
                          <span className="font-medium">
                            Start After Verification
                          </span>
                          {isPaidUser && (
                            <Badge variant="secondary" className="text-xs">
                              Recommended
                            </Badge>
                          )}
                          {!isPaidUser && (
                            <Badge variant="outline" className="text-xs">
                              <Crown className="w-3 h-3 mr-1" />
                              Paid
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Timer starts individually for each recipient after
                          they verify their email
                        </p>
                      </div>
                    </label>

                    <label
                      htmlFor="creation"
                      className={`flex items-start space-x-3 border rounded-lg p-4 cursor-pointer transition-all ${
                        formData.timerMode === "creation"
                          ? "border-primary bg-primary/5"
                          : "border-gray-200 hover:border-gray-300 dark:border-gray-700 dark:hover:border-gray-600"
                      }`}
                    >
                      <RadioGroupItem
                        value="creation"
                        id="creation"
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <CalendarDays className="w-4 h-4 text-primary" />
                          <span className="font-medium">Fixed Deadline</span>
                          {!isPaidUser && (
                            <Badge variant="secondary" className="text-xs">
                              Free
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          All recipients share the same expiry deadline from
                          drop creation
                        </p>
                      </div>
                    </label>
                  </div>
                </RadioGroup>
              </div>

              <div>
                <Label htmlFor="timeLimit" className="mb-2 block">
                  {formData.timerMode === "verification"
                    ? "Access Duration per Recipient"
                    : "Drop Expires In"}
                </Label>
                <select
                  id="timeLimit"
                  value={
                    formData.defaultTimeLimitHours !== null
                      ? formData.defaultTimeLimitHours
                      : "custom"
                  }
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === "custom") {
                      updateField("defaultTimeLimitHours", null);
                    } else {
                      updateField("defaultTimeLimitHours", parseInt(value));
                      setCustomDateTime("");
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary dark:bg-gray-800 dark:border-gray-600"
                >
                  {getAvailableTimeOptions().map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                  <option value="custom">Custom</option>
                </select>
                {errors.timeLimit && (
                  <p className="text-sm text-red-500 mt-1">{errors.timeLimit}</p>
                )}

                {/* If "creation" mode and user selected "custom" */}
                {formData.timerMode === "creation" &&
                  formData.defaultTimeLimitHours === null && (
                    <div className="mt-3">
                      <Label htmlFor="customDateTime" className="block mb-2">
                        Custom Expiry Date/Time
                      </Label>
                      <Input
                        id="customDateTime"
                        type="datetime-local"
                        value={customDateTime}
                        onChange={(e) => setCustomDateTime(e.target.value)}
                      />
                    </div>
                  )}

                <p className="text-sm text-gray-500 mt-2">
                  Current selection: {getTimeLimitDisplay()}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Submit */}
          <div className="flex justify-end">
            <Button type="submit" disabled={isSubmitting} className="px-6 py-3">
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Create Drop
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}