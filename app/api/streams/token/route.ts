import { AccessToken } from "livekit-server-sdk";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { room, username, role = "viewer" } = body;

    if (!room) {
      return NextResponse.json({ error: 'Missing "room" property' }, { status: 400 });
    }
    if (!username) {
      return NextResponse.json({ error: 'Missing "username" property' }, { status: 400 });
    }

    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;

    if (!apiKey || !apiSecret) {
      return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
    }

    const at = new AccessToken(apiKey, apiSecret, {
      identity: username,
    });

    at.addGrant({ 
      roomJoin: true, 
      room: room,
      canPublish: role === "streamer",
      canSubscribe: true
    });

    return NextResponse.json({ token: await at.toJwt() });
  } catch (error) {
    console.error("Token generation error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
