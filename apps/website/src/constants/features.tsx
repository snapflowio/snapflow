import { ClipboardCheckIcon, DiamondIcon, Edit3Icon, ListChecksIcon } from "lucide-react";

export const features = (iconSize: number) => [
  {
    icon: <Edit3Icon size={iconSize} />,
    title: "Note Taking",
    description: "Write your study notes and let Snapflow take care of the rest.",
  },
  {
    icon: <DiamondIcon size={iconSize} />,
    title: "Flashcards",
    description: "Create flashcards with reminders or let AI auto-suggest them for you.",
  },
  {
    icon: <ListChecksIcon size={iconSize} />,
    title: "Task Management",
    description: "Create module specific tasks to keep on track with what you need to do.",
  },
  {
    icon: <ClipboardCheckIcon size={iconSize} />,
    title: "Grade Tracking",
    description: "Find out what you need to achieve to stay in progression.",
  },
];
