import { NextResponse } from "next/server";
import { createRoomDB, getRoomsDB } from "@/lib/db";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const topic = searchParams.get("topic");

  try {
    const rooms = await getRoomsDB(topic || undefined);
    return NextResponse.json(rooms);
  } catch (error: any) {
    console.error("Failed to fetch rooms:", error);
    return NextResponse.json({ 
      error: "Internal Server Error", 
      details: error.message || String(error),
      env_check: {
        url_exists: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        key_exists: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        node_env: process.env.NODE_ENV
      }
    }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { topic, stance, creatorName, title, description, settings } = await req.json();
    
    if (!topic || !stance || !creatorName) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const newRoom = await createRoomDB(topic, stance, creatorName, title, description, settings);
    return NextResponse.json(newRoom);
  } catch (error) {
    console.error("Failed to create room:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
