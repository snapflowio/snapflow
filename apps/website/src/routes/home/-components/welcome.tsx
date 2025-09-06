import { useSession } from "@/hooks/use-session";
import { Skeleton } from "@snapflow/ui";

export function WelcomeMessage() {
  const { user, isLoading } = useSession();

  if (isLoading || !user) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-2/5" />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="h-5 w-1/2" />
        </div>
      </div>
    );
  }

  const currentHour = new Date().getHours();

  let timeGreeting: string;
  if (currentHour < 12) {
    timeGreeting = "Good morning";
  } else if (currentHour < 18) {
    timeGreeting = "Good afternoon";
  } else {
    timeGreeting = "Good evening";
  }

  const quotes = [
    "Education is the most powerful weapon which you can use to change the world. - Nelson Mandela",
    "The only way to learn mathematics is to do mathematics. - Paul Halmos",
    "Success is the sum of small efforts, repeated day in and day out. - Robert Collier",
    "The expert in anything was once a beginner. - Helen Hayes",
    "It always seems impossible until it's done. - Nelson Mandela",
    "Learning is a treasure that will follow its owner everywhere. - Chinese Proverb",
    "The beautiful thing about learning is that no one can take it away from you. - B.B. King",
    "Education is not preparation for life; education is life itself. - John Dewey",
    "The best way to predict the future is to create it. - Peter Drucker",
    "Small steps daily lead to big changes yearly. - Anonymous",
    "Progress, not perfection, is the goal. - Anonymous",
    "Every master was once a disaster. - T. Harv Eker"
  ];

  const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
  const greeting = user.name ? `${timeGreeting}, ${user.name}!` : `${timeGreeting}!`;

  return (
    <div className="space-y-3">
      <h1 className="font-semibold text-4xl">{greeting}</h1>
      <p className="max-w-prose text-balance text-foreground-muted text-sm leading-6">
        "{randomQuote}"
      </p>
    </div>
  );
}
