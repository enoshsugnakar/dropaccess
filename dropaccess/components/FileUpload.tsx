import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRef } from "react";
import { Paperclip } from "lucide-react";

export function FileUpload({
  value,
  onChange,
}: {
  value: File[];
  onChange: (files: File[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div>
      <Button
        type="button"
        variant="outline"
        onClick={() => inputRef.current?.click()}
        className="flex items-center gap-2"
      >
        <Paperclip className="w-4 h-4" />
        {value.length === 0 ? "Choose Files" : "Change Files"}
      </Button>
      <Input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) {
            onChange(Array.from(e.target.files));
          }
        }}
      />
      <div className="mt-2 space-y-1">
        {value.map((file) => (
          <div key={file.name} className="text-sm text-muted-foreground">
            {file.name}
          </div>
        ))}
      </div>
    </div>
  );
}