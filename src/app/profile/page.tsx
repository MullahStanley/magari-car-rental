import { redirect } from "next/navigation";
import { User } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { auth, currentUser } from "@clerk/nextjs/server";
import { getOrCreateProfile } from "@/lib/profile";
import { VerifyButton } from "@/components/verification/verify-button";

export const metadata = {
  title: "Profile — Magari",
};

export default async function ProfilePage() {
  const { userId } = await auth();
  const user = await currentUser();

  if (!userId || !user) redirect("/auth/login?redirect=/profile");

  const profile = await getOrCreateProfile(userId, {
    fullName:
      [user.firstName, user.lastName].filter(Boolean).join(" ") ||
      user.emailAddresses[0]?.emailAddress ||
      null,
    email: user.emailAddresses[0]?.emailAddress ?? null,
  });

  const isVerified =
    typeof user.publicMetadata?.verified === "boolean" &&
    user.publicMetadata.verified === true;

  return (
    <div className="container mx-auto max-w-lg px-4 py-8">
      <h1 className="text-3xl font-bold">Profile</h1>
      <p className="mt-2 text-muted-foreground">Your account details</p>

      <Card className="mt-8">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <User className="h-6 w-6 text-primary" />
            </div>
            <div>
              <CardTitle>{profile?.full_name ?? "User"}</CardTitle>
              <CardDescription>
                {user.emailAddresses[0]?.emailAddress}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Role</span>
            <span className="capitalize">{profile?.role ?? "user"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Member since</span>
            <span>
              {new Date(user.createdAt).toLocaleDateString("en-US", {
                month: "long",
                year: "numeric",
              })}
            </span>
          </div>
        </CardContent>
      </Card>

      <div className="mt-8">
        <VerifyButton isVerified={isVerified} />
      </div>
    </div>
  );
}
