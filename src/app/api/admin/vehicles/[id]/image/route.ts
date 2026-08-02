import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateProfile } from "@/lib/profile";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check admin role
  const profile = await getOrCreateProfile(userId);

  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = await createClient();

  const { id } = await params;
  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  // Validate file type
  const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json(
      { error: "Invalid file type. Allowed: JPEG, PNG, WebP, GIF" },
      { status: 400 }
    );
  }

  // Validate file size (5MB max)
  const maxSize = 5 * 1024 * 1024;
  if (file.size > maxSize) {
    return NextResponse.json(
      { error: "File too large. Maximum size: 5MB" },
      { status: 400 }
    );
  }

  // Verify the vehicle exists
  const { data: vehicle } = await supabase
    .from("vehicles")
    .select("id")
    .eq("id", id)
    .single();

  if (!vehicle) {
    return NextResponse.json({ error: "Vehicle not found" }, { status: 404 });
  }

  // Generate a unique file path
  const ext = file.name.split(".").pop() || "jpg";
  const filePath = `images/${id}/${Date.now()}.${ext}`;

  // Upload to Supabase storage
  const { error: uploadError } = await supabase.storage
    .from("vehicle-assets")
    .upload(filePath, file, {
      cacheControl: "3600",
      upsert: false,
    });

  if (uploadError) {
    console.error("Upload error:", uploadError);
    return NextResponse.json(
      { error: "Failed to upload image" },
      { status: 500 }
    );
  }

  // Get the public URL
  const {
    data: { publicUrl },
  } = supabase.storage.from("vehicle-assets").getPublicUrl(filePath);

  // Update the vehicle record with the new image URL
  const { error: updateError } = await supabase
    .from("vehicles")
    .update({ image_url: publicUrl })
    .eq("id", id);

  if (updateError) {
    console.error("Update error:", updateError);
    return NextResponse.json(
      { error: "Failed to update vehicle" },
      { status: 500 }
    );
  }

  // If there was a previous image in Supabase storage, try to delete it
  const oldImageUrl = formData.get("oldImageUrl") as string | null;
  if (oldImageUrl && oldImageUrl.includes("/storage/v1/object/public/vehicle-assets/")) {
    const oldPath = oldImageUrl.split("/vehicle-assets/")[1];
    if (oldPath) {
      await supabase.storage.from("vehicle-assets").remove([oldPath]);
    }
  }

  return NextResponse.json({ url: publicUrl });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await getOrCreateProfile(userId);

  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = await createClient();

  const { id } = await params;

  // Get current image URL
  const { data: vehicle } = await supabase
    .from("vehicles")
    .select("image_url")
    .eq("id", id)
    .single();

  if (vehicle?.image_url?.includes("/storage/v1/object/public/vehicle-assets/")) {
    const filePath = vehicle.image_url.split("/vehicle-assets/")[1];
    if (filePath) {
      await supabase.storage.from("vehicle-assets").remove([filePath]);
    }
  }

  // Set image_url to null
  const { error } = await supabase
    .from("vehicles")
    .update({ image_url: null })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: "Failed to remove image" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
