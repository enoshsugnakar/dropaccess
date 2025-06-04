"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/lib/supabaseClient";

type DropFormData = {
  name: string;
  email: string;
  expires_at: string;
  file: FileList;
};

export function DropForm() {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<DropFormData>();
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(data: DropFormData) {
    setSuccess(null);
    setError(null);

    try {
      // 1. Upload file to Supabase Storage (if present)
      let fileUrl = "";
      if (data.file && data.file[0]) {
        const file = data.file[0];
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("drop-files")
          .upload(`${Date.now()}-${file.name}`, file);

        if (uploadError) {
          throw new Error("File upload failed: " + uploadError.message);
        }
        fileUrl = uploadData?.path ?? "";
      }

      // 2. Insert the drop row (you may want to customize columns as per your schema)
      const { error: insertError } = await supabase.from("drops").insert([
        {
          name: data.name,
          expires_at: data.expires_at,
          // add more fields as needed
        },
      ]);
      if (insertError) {
        throw new Error("Failed to create drop: " + insertError.message);
      }

      setSuccess("Drop created successfully!");
      reset();
    } catch (err: any) {
      setError(err.message ?? "Something went wrong.");
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="name">Drop Name</Label>
        <Input
          id="name"
          placeholder="e.g. Project files"
          {...register("name", { required: "Drop Name is required" })}
        />
        {errors.name && (
          <p className="text-destructive text-xs">{errors.name.message}</p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">Recipient Email</Label>
        <Input
          id="email"
          type="email"
          placeholder="e.g. user@example.com"
          {...register("email", {
            required: "Email is required",
            pattern: { value: /\S+@\S+\.\S+/, message: "Invalid email" },
          })}
        />
        {errors.email && (
          <p className="text-destructive text-xs">{errors.email.message}</p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="expires_at">Expiration Date</Label>
        <Input
          id="expires_at"
          type="datetime-local"
          {...register("expires_at", { required: "Expiration date is required" })}
        />
        {errors.expires_at && (
          <p className="text-destructive text-xs">{errors.expires_at.message}</p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="file">Upload File</Label>
        <Input
          id="file"
          type="file"
          {...register("file")}
        />
      </div>
      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? "Creating..." : "Create Drop"}
      </Button>
      {success && (
        <Alert variant="default" className="mt-4">
          <AlertTitle className="text-primary">Success!</AlertTitle>
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}
      {error && (
        <Alert variant="destructive" className="mt-4">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </form>
  );
}