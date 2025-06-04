import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import { useState } from "react";

export function EmailInput({
  value,
  onChange,
}: {
  value: string[];
  onChange: (emails: string[]) => void;
}) {
  const [input, setInput] = useState("");

  const addEmail = () => {
    if (input && /\S+@\S+\.\S+/.test(input) && !value.includes(input)) {
      onChange([...value, input]);
      setInput("");
    }
  };

  const removeEmail = (email: string) => {
    onChange(value.filter((e) => e !== email));
  };

  return (
    <div>
      <div className="flex gap-2">
        <Input
          type="email"
          placeholder="Type email and press Enter"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addEmail();
            }
          }}
        />
        <Button type="button" onClick={addEmail} variant="secondary">
          Add
        </Button>
      </div>
      <div className="flex flex-wrap gap-2 mt-2">
        {value.map((email) => (
          <Badge key={email} variant="secondary" className="flex items-center space-x-1">
            <span>{email}</span>
            <button
              type="button"
              onClick={() => removeEmail(email)}
              className="ml-1"
            >
              <X className="w-3 h-3" />
            </button>
          </Badge>
        ))}
      </div>
    </div>
  );
}