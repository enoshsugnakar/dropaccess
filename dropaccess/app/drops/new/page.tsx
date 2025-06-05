import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { DropForm } from "@/components/DropForm";
import { Navbar } from "@/components/Navbar";

export default function NewDropPage() {
  return (
    <div className="min-h-screen bg-background py-8">
      <Navbar/>
      <div className="container lg:ml-20 max-w-auto mx-auto px-4">
        <DropForm />
      </div>
    </div>
  );
}