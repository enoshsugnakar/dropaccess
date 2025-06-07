"use client";
 
import * as React from "react";
import { CalendarIcon } from "@radix-ui/react-icons";
import { format } from "date-fns";
 
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

interface DateTimePickerProps {
  value?: Date;
  onChange: (date: Date | undefined) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}
 
export function DateTimePicker({ 
  value, 
  onChange, 
  placeholder = "Select date and time",
  className,
  disabled = false
}: DateTimePickerProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  
  const hours = Array.from({ length: 12 }, (_, i) => i + 1);
  
  const handleDateSelect = (selectedDate: Date | undefined) => {
    if (selectedDate) {
      // If no current value, set time to current time
      if (!value) {
        const now = new Date();
        selectedDate.setHours(now.getHours());
        selectedDate.setMinutes(now.getMinutes());
      } else {
        // Preserve existing time
        selectedDate.setHours(value.getHours());
        selectedDate.setMinutes(value.getMinutes());
      }
      onChange(selectedDate);
    }
  };

  const handleTimeChange = (
    type: "hour" | "minute" | "ampm",
    timeValue: string
  ) => {
    // If no date selected, use today
    let newDate = value ? new Date(value) : new Date();
    
    if (type === "hour") {
      const hour = parseInt(timeValue);
      const isPM = newDate.getHours() >= 12;
      newDate.setHours(isPM ? (hour === 12 ? 12 : hour + 12) : (hour === 12 ? 0 : hour));
    } else if (type === "minute") {
      newDate.setMinutes(parseInt(timeValue));
    } else if (type === "ampm") {
      const currentHours = newDate.getHours();
      if (timeValue === "PM" && currentHours < 12) {
        newDate.setHours(currentHours + 12);
      } else if (timeValue === "AM" && currentHours >= 12) {
        newDate.setHours(currentHours - 12);
      }
    }
    onChange(newDate);
  };

  const getCurrentHour12 = () => {
    if (!value) return 12;
    const hour24 = value.getHours();
    return hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
  };

  const getCurrentAMPM = () => {
    if (!value) return "AM";
    return value.getHours() >= 12 ? "PM" : "AM";
  };

  if (disabled) {
    return (
      <Button
        variant="outline"
        className={cn(
          "w-full justify-start text-left font-normal",
          "text-muted-foreground cursor-not-allowed opacity-50",
          className
        )}
        disabled
      >
        <CalendarIcon className="mr-2 h-4 w-4" />
        <span>{placeholder}</span>
      </Button>
    );
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal",
            !value && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {value ? (
            format(value, "MM/dd/yyyy hh:mm aa")
          ) : (
            <span>{placeholder}</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="sm:flex">
          <Calendar
            mode="single"
            selected={value}
            onSelect={handleDateSelect}
            disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
            initialFocus
          />
          <div className="flex flex-col sm:flex-row sm:h-[300px] divide-y sm:divide-y-0 sm:divide-x">
            {/* Hours */}
            <ScrollArea className="w-64 sm:w-auto">
              <div className="flex sm:flex-col p-2">
                {hours.map((hour) => (
                  <Button
                    key={hour}
                    size="icon"
                    variant={
                      value && getCurrentHour12() === hour
                        ? "default"
                        : "ghost"
                    }
                    className="sm:w-full shrink-0 aspect-square"
                    onClick={() => handleTimeChange("hour", hour.toString())}
                  >
                    {hour}
                  </Button>
                ))}
              </div>
              <ScrollBar orientation="horizontal" className="sm:hidden" />
            </ScrollArea>
            {/* Minutes */}
            <ScrollArea className="w-64 sm:w-auto">
              <div className="flex sm:flex-col p-2">
                {Array.from({ length: 12 }, (_, i) => i * 5).map((minute) => (
                  <Button
                    key={minute}
                    size="icon"
                    variant={
                      value && value.getMinutes() === minute
                        ? "default"
                        : "ghost"
                    }
                    className="sm:w-full shrink-0 aspect-square"
                    onClick={() =>
                      handleTimeChange("minute", minute.toString())
                    }
                  >
                    {minute.toString().padStart(2, '0')}
                  </Button>
                ))}
              </div>
              <ScrollBar orientation="horizontal" className="sm:hidden" />
            </ScrollArea>
            {/* AM/PM */}
            <ScrollArea className="">
              <div className="flex sm:flex-col p-2">
                {["AM", "PM"].map((ampm) => (
                  <Button
                    key={ampm}
                    size="icon"
                    variant={
                      value && getCurrentAMPM() === ampm
                        ? "default"
                        : "ghost"
                    }
                    className="sm:w-full shrink-0 aspect-square"
                    onClick={() => handleTimeChange("ampm", ampm)}
                  >
                    {ampm}
                  </Button>
                ))}
              </div>
            </ScrollArea>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}