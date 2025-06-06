
import { DropForm } from "@/components/DropForm";
import { Navbar } from "@/components/Navbar";

export default function NewDropPage() {
  return (
    <div>
      <Navbar/>
      <div className="mt-5">
        <DropForm />
      </div>
    </div>
  );
}