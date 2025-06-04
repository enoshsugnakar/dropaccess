import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { DropForm } from "@/components/DropForm";

export default function NewDropPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Card className="w-full max-w-lg shadow-lg border border-primary">
        <CardHeader>
          <CardTitle className="text-primary text-2xl">Create a New Drop</CardTitle>
        </CardHeader>
        <CardContent>
          <DropForm />
        </CardContent>
      </Card>
    </div>
  );
}