import axios from 'axios';
import FormData from 'form-data'; // Use form-data package for Node.js environments
import jwt from 'jsonwebtoken';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    // 1. Verify JWT for authentication
    const authorizationHeader = req.headers.get('Authorization');
    if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authorizationHeader.split(' ')[1];

    if (!process.env.JWT_SECRET) {
      console.error('JWT_SECRET environment variable is not set.');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    let decodedToken: any;
    try {
      decodedToken = jwt.verify(token, process.env.JWT_SECRET!); // Verify the token
    } catch (err: any) {
      console.error('JWT verification failed:', err);
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Ensure user ID exists in token payload
    if (!decodedToken.id) {
      return NextResponse.json({ error: 'Invalid token payload (missing user ID)' }, { status: 401 });
    }

    // 2. Parse the incoming multipart form data
    // Note: This requires the `formidable` package to be installed
    const formData = await req.formData(); // Next.js native FormData parsing
    const file = formData.get('file');
    const pinataMetadata = formData.get('pinataMetadata');

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    // Convert Blob to Node.js Buffer
    const fileBuffer = Buffer.from(await (file as Blob).arrayBuffer());

    // 3. Prepare data for Pinata upload
    const pinataFormData = new FormData();
    pinataFormData.append('file', fileBuffer, (file as File).name); // Append file with original name
    if (pinataMetadata) {
      pinataFormData.append('pinataMetadata', pinataMetadata);
    }
    
    // 4. Upload to Pinata IPFS
    const pinataUrl = `https://api.pinata.cloud/pinning/pinFileToIPFS`;
    const pinataApiKey = process.env.NEXT_PUBLIC_PINATA_API_KEY;
    const pinataSecretKey = process.env.PINATA_SECRET_API_KEY;

    if (!pinataApiKey || !pinataSecretKey) {
      console.error('Pinata API keys are not set in environment variables.');
      return NextResponse.json({ error: 'Pinata API keys not configured on server' }, { status: 500 });
    }

    const pinataResponse = await axios.post(pinataUrl, pinataFormData, {
      maxBodyLength: Infinity, // Important for large files
      headers: {
        ...
        pinataFormData.getHeaders(), // Get headers for multipart/form-data
        pinata_api_key: pinataApiKey,
        pinata_secret_api_key: pinataSecretKey,
      },
    });

    if (pinataResponse.status !== 200) {
      console.error('Pinata upload failed:', pinataResponse.data);
      return NextResponse.json({ error: pinataResponse.data.error || 'Pinata upload failed' }, { status: pinataResponse.status });
    }

    const ipfsHash = pinataResponse.data.IpfsHash;
    const ipfsGatewayUrl = `https://gateway.pinata.cloud/ipfs/${ipfsHash}`;

    return NextResponse.json({ ipfsHash, ipfsGatewayUrl }, { status: 200 });

  } catch (error: any) {
    console.error('API Route /api/ipfs/upload error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
