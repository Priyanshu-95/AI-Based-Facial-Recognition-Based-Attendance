import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Candidate {
  user_id: string;
  full_name: string;
  enrollment_number?: string;
  roll_number?: string;
  signedUrl: string;
}

// Compare a batch of candidates using Lovable/Gemini Gateway
async function compareBatch(
  capturedImage: string,
  candidates: Candidate[],
  lovableApiKey: string
): Promise<{ matchedUserId: string | null; confidence: number; reason: string } | null> {
  try {
    const contentList = [
      {
        type: "text",
        text: "Below is the primary 'Captured Face' image, followed by the candidate images. Match the Captured Face against the candidate faces."
      },
      {
        type: "text",
        text: "=== Captured Face ==="
      },
      {
        type: "image_url",
        image_url: { url: capturedImage }
      }
    ];

    candidates.forEach((candidate) => {
      contentList.push({
        type: "text",
        text: `=== Candidate Face (User ID: ${candidate.user_id}) ===`
      });
      contentList.push({
        type: "image_url",
        image_url: { url: candidate.signedUrl }
      });
    });

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are an extremely accurate face recognition system.
Determine if the person in the "Captured Face" is the same person as one of the "Candidate Faces".

Instructions:
1. Examine the "Captured Face" image (labeled below).
2. Examine the "Candidate Face" images (labeled below with their User IDs).
3. Identify which Candidate Face (if any) is the same person as the Captured Face.
4. Respond in JSON format only with:
   - "matchedUserId": the User ID of the matching candidate, or null if no match is found.
   - "confidence": confidence score from 0 to 100.
   - "reason": brief explanation of why they match or why no match was found.

IMPORTANT: Only return the JSON object, no other text.`
          },
          {
            role: "user",
            content: contentList
          }
        ],
        response_format: { type: "json_object" }
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error(`AI API batch error:`, errorText);
      return null;
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content;
    
    if (!content) {
      console.error(`No content in AI response for batch`);
      return null;
    }

    let result;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        result = JSON.parse(content);
      }
    } catch (parseError) {
      console.error(`Failed to parse AI response for batch:`, content);
      return null;
    }

    return {
      matchedUserId: result.matchedUserId || null,
      confidence: typeof result.confidence === "number" ? result.confidence : 0,
      reason: result.reason || ""
    };
  } catch (error) {
    console.error("Error in compareBatch:", error);
    return null;
  }
}

// Compare a batch of candidates using Google Gemini API directly
async function compareBatchDirect(
  capturedImage: string,
  candidates: Candidate[],
  geminiApiKey: string
): Promise<{ matchedUserId: string | null; confidence: number; reason: string } | null> {
  try {
    const parts = [
      {
        text: `You are an extremely accurate face recognition system.
Determine if the person in the "Captured Face" is the same person as one of the "Candidate Faces".

Instructions:
1. Examine the "Captured Face" image (labeled below).
2. Examine the "Candidate Face" images (labeled below with their User IDs).
3. Identify which Candidate Face (if any) is the same person as the Captured Face.
4. Respond in JSON format only with:
   - "matchedUserId": the User ID of the matching candidate, or null if no match is found.
   - "confidence": confidence score from 0 to 100.
   - "reason": brief explanation of why they match or why no match was found.

IMPORTANT: Only return the JSON object, no other text.`
      },
      {
        text: "=== Captured Face ==="
      }
    ];

    // Add captured image as base64 inlineData
    const capturedBase64Data = capturedImage.split(",")[1];
    parts.push({
      inlineData: {
        mimeType: "image/jpeg",
        data: capturedBase64Data
      }
    } as any);

    // Fetch and download each candidate image in the batch to send as inlineData
    for (let i = 0; i < candidates.length; i++) {
      const candidate = candidates[i];
      parts.push({
        text: `=== Candidate Face (User ID: ${candidate.user_id}) ===`
      } as any);

      try {
        const res = await fetch(candidate.signedUrl);
        if (res.ok) {
          const arrayBuffer = await res.arrayBuffer();
          const uint8Array = new Uint8Array(arrayBuffer);
          let binary = '';
          for (let k = 0; k < uint8Array.length; k++) {
            binary += String.fromCharCode(uint8Array[k]);
          }
          const base64 = btoa(binary);
          parts.push({
            inlineData: {
              mimeType: "image/jpeg",
              data: base64
            }
          } as any);
        } else {
          console.error(`Failed to fetch image for candidate ${candidate.full_name}`);
        }
      } catch (err) {
        console.error(`Error downloading candidate image ${candidate.full_name}:`, err);
      }
    }

    const aiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${geminiApiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: parts
          }
        ],
        generationConfig: {
          responseMimeType: "application/json"
        }
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error(`Gemini Direct API batch error:`, errorText);
      return null;
    }

    const aiData = await aiResponse.json();
    const content = aiData.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!content) {
      console.error(`No content in Gemini response`);
      return null;
    }

    let result;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        result = JSON.parse(content);
      }
    } catch (parseError) {
      console.error(`Failed to parse Gemini response:`, content);
      return null;
    }

    return {
      matchedUserId: result.matchedUserId || null,
      confidence: typeof result.confidence === "number" ? result.confidence : 0,
      reason: result.reason || ""
    };
  } catch (error) {
    console.error("Error in compareBatchDirect:", error);
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { capturedImage } = await req.json();

    if (!capturedImage) {
      return new Response(
        JSON.stringify({ status: "failed", reason: "no_image", message: "No image provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Received face scan attendance request");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("user_id, full_name, enrollment_number, roll_number, face_image_url")
      .not("face_image_url", "is", null);

    if (profilesError) {
      console.error("Error fetching profiles:", profilesError);
      return new Response(
        JSON.stringify({ status: "failed", reason: "database_error", message: "Failed to fetch profiles" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!profiles || profiles.length === 0) {
      return new Response(
        JSON.stringify({ status: "failed", reason: "no_registered_faces", message: "No registered faces in the system" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${profiles.length} profiles with face images`);

    // Verify AI Credentials (either Lovable AI Gateway key or direct Google Gemini API key)
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");

    if (!lovableApiKey && !geminiApiKey) {
      console.error("Neither LOVABLE_API_KEY nor GEMINI_API_KEY is configured");
      return new Response(
        JSON.stringify({ status: "failed", reason: "config_error", message: "AI service credentials not configured on server" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const pathMap = new Map();
    const paths: string[] = [];

    for (const profile of profiles) {
      if (!profile.face_image_url) continue;
      
      const urlParts = profile.face_image_url.split('/storage/v1/object/public/face-images/');
      if (urlParts.length === 2) {
        const path = urlParts[1];
        paths.push(path);
        pathMap.set(path, profile);
      } else {
        console.warn('Profile face_image_url not in standard face-images bucket format:', profile.face_image_url);
      }
    }

    const profilesWithUrls: Candidate[] = [];
    if (paths.length > 0) {
      console.log(`Generating signed URLs for ${paths.length} files...`);
      const { data: signedUrlsData, error: signedUrlsError } = await supabase.storage
        .from('face-images')
        .createSignedUrls(paths, 300);

      if (signedUrlsError) {
        console.error("Error creating signed URLs:", signedUrlsError);
        return new Response(
          JSON.stringify({ status: "failed", reason: "storage_error", message: "Failed to generate access to face images" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (signedUrlsData) {
        for (const item of signedUrlsData) {
          if (item.error) {
            console.error(`Error signing URL for path ${item.path}:`, item.error);
            continue;
          }
          const profile = pathMap.get(item.path);
          if (profile && item.signedUrl) {
            profilesWithUrls.push({
              user_id: profile.user_id,
              full_name: profile.full_name,
              enrollment_number: profile.enrollment_number,
              roll_number: profile.roll_number,
              signedUrl: item.signedUrl
            });
          }
        }
      }
    }

    if (profilesWithUrls.length === 0) {
      return new Response(
        JSON.stringify({ status: "failed", reason: "no_registered_faces", message: "No valid registered faces in the system" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Successfully generated signed URLs for ${profilesWithUrls.length} candidates`);

    const batchSize = 15;
    const batches: Candidate[][] = [];
    for (let i = 0; i < profilesWithUrls.length; i += batchSize) {
      batches.push(profilesWithUrls.slice(i, i + batchSize));
    }

    console.log(`Running comparison across ${batches.length} parallel batches...`);

    const batchPromises = batches.map(batch => {
      if (geminiApiKey) {
        // Use direct Google Gemini API call
        console.log("Using direct Google Gemini API...");
        return compareBatchDirect(capturedImage, batch, geminiApiKey);
      } else {
        // Fall back to Lovable AI Gateway
        console.log("Using Lovable AI Gateway...");
        return compareBatch(capturedImage, batch, lovableApiKey!);
      }
    });

    const batchResults = await Promise.all(batchPromises);

    let matchedUserId: string | null = null;
    let highestConfidence = 0;

    for (const result of batchResults) {
      if (result && result.matchedUserId && result.confidence > highestConfidence) {
        highestConfidence = result.confidence;
        matchedUserId = result.matchedUserId;
      }
    }

    const CONFIDENCE_THRESHOLD = 70;

    if (!matchedUserId || highestConfidence < CONFIDENCE_THRESHOLD) {
      console.log(`No match found. Highest confidence: ${highestConfidence}`);

      return new Response(
        JSON.stringify({
          status: "failed",
          reason: "no_match",
          message: "No matching face found in the database. Please try again or contact admin.",
          confidence: highestConfidence,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const matchedProfile = profiles.find(p => p.user_id === matchedUserId);

    if (!matchedProfile) {
      console.error(`Matched user ID ${matchedUserId} but profile not found in initial fetch`);
      return new Response(
        JSON.stringify({ status: "failed", reason: "server_error", message: "An unexpected error occurred" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const { data: existingAttendance } = await supabase
      .from("attendance_records")
      .select("id")
      .eq("user_id", matchedProfile.user_id)
      .eq("status", "present")
      .gte("marked_at", today.toISOString())
      .lt("marked_at", tomorrow.toISOString())
      .maybeSingle();

    if (existingAttendance) {
      return new Response(
        JSON.stringify({ 
          status: "already_marked", 
          message: "Attendance already marked for today",
          student: {
            name: matchedProfile.full_name,
            enroll: matchedProfile.enrollment_number || matchedProfile.roll_number || "N/A"
          }
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { error: insertError } = await supabase.from("attendance_records").insert({
      user_id: matchedProfile.user_id,
      status: "present",
      method: "face_scan",
      student_name: matchedProfile.full_name,
      enrollment_number: matchedProfile.enrollment_number || matchedProfile.roll_number,
      face_verified: true,
    });

    if (insertError) {
      console.error("Error inserting attendance:", insertError);
      return new Response(
        JSON.stringify({ status: "failed", reason: "database_error", message: "Failed to mark attendance" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Attendance marked for ${matchedProfile.full_name} with confidence ${highestConfidence}%`);

    return new Response(
      JSON.stringify({
        status: "success",
        message: "Attendance marked successfully",
        student: {
          name: matchedProfile.full_name,
          enroll: matchedProfile.enrollment_number || matchedProfile.roll_number || "N/A"
        },
        confidence: highestConfidence
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ status: "failed", reason: "server_error", message: "An unexpected error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
