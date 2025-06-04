"use client";

import { useForm } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { useState } from "react";

export function DropForm() {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm();
  const [success, setSuccess] = useState(false);

  function onSubmit(data: any) {
    setSuccess(true);
    setTimeout(() => setSuccess(false), 2000);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="name">Drop Name</Label>
        <Input
          id="name"
          {...register("name", { required: "Drop Name is required" })}
          placeholder="e.g. Project files"
        />
        {errors.name?.message && (
          <p className="text-destructive text-xs">{errors.name.message as string}</p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">Recipient Email</Label>
        <Input
          id="email"
          {...register("email", { required: "Email is required" })}
          placeholder="e.g. user@example.com"
        />
        {errors.email?.message && (
          <p className="text-destructive text-xs">{errors.email.message as string}</p>
        )}
      </div>
      {/* Add more fields as needed, using the same pattern */}
      <Button type="submit" className="w-full" disabled={isSubmitting}>
        Create Drop
      </Button>
      {success && (
        <Alert>
          <AlertTitle>Success!</AlertTitle>
          <AlertDescription>Your drop has been created.</AlertDescription>
        </Alert>
      )}
    </form>
  );
}