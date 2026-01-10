import { IngressClient, IngressInput } from "livekit-server-sdk";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { roomName, streamerName, communityId } = await request.json();

    if (!roomName || !streamerName) {
      return NextResponse.json({ error: "Missing required params" }, { status: 400 });
    }

    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;

    if (!apiKey || !apiSecret || !livekitUrl) {
      return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
    }

    const ingressClient = new IngressClient(livekitUrl, apiKey, apiSecret);

    // Create Ingress
    const ingress = await ingressClient.createIngress(IngressInput.RTMP_INPUT, {
      name: `${streamerName}-ingress`,
      roomName: roomName,
      participantName: streamerName,
      participantIdentity: streamerName,
    });

    return NextResponse.json({ 
      ingressId: ingress.ingressId,
      url: ingress.url,
      streamKey: ingress.streamKey 
    });
  } catch (error: any) {
    console.error("Ingress creation error:", error);
    return NextResponse.json({ error: error.message || "Internal Error" }, { status: 500 });
  }
}
