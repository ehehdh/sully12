import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

// GET: 이슈 목록 조회
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const showAll = searchParams.get("all") === "true";
  const id = searchParams.get("id");
  
  const supabase = getSupabase();
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from("issues")
    .select("*")
    .order("created_at", { ascending: false });
    
  if (id) {
    query = query.eq("id", id);
  } else if (!showAll) {
    query = query.eq("is_active", true);
  }
  
  const { data, error } = await query;
  
  if (error) {
    console.error("Failed to fetch issues:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  
  return NextResponse.json(data);
}

// POST: 이슈 추가
export async function POST(req: Request) {
  try {
    const { title, description, detailed_description, category } = await req.json();
    
    if (!title || !description) {
      return NextResponse.json(
        { error: "title and description are required" },
        { status: 400 }
      );
    }
    
    const supabase = getSupabase();
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from("issues")
      .insert({
        title,
        description,
        detailed_description,
        category: category || "일반",
      })
      .select()
      .single();
      
    if (error) {
      console.error("Failed to add issue:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    return NextResponse.json({
      success: true,
      issue: data,
    });
  } catch (error) {
    console.error("Add issue error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// DELETE: 이슈 삭제
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const issueId = searchParams.get("id");
    
    if (!issueId) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }
    
    const supabase = getSupabase();
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from("issues")
      .delete()
      .eq("id", issueId);
      
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete issue error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// PATCH: 이슈 활성화/비활성화 (또는 업데이트)
export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { id, ...updates } = body;
    
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }
    
    const supabase = getSupabase();
    
    // Toggle logic implies getting current state, but simple update is better.
    // If only ID is provided, assume toggle (legacy behavior support if needed, but better to be explicit)
    // For now, let's just fetch and toggle if no other updates, OR just handle specific updates.
    // To keep it simple and compatible with the "toggle" button in Admin:
    
    let updateData = { ...updates };
    
    if (Object.keys(updates).length === 0) {
      // Toggle behavior
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: current } = await (supabase as any).from("issues").select("is_active").eq("id", id).single();
      if (current) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        updateData = { is_active: !(current as any).is_active };
      }
    }
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any)
      .from("issues")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();
      
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    return NextResponse.json({ success: true, issue: data });
  } catch (error) {
    console.error("Update issue error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
