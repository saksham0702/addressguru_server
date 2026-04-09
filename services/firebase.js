import admin from "firebase-admin";
import fs from "fs";
import path from "path";
import { GoogleAuth } from "google-auth-library";
import { FIREBASE_SERVICE_ACCOUNT_PATH } from "./constant.js";

let firebaseApp = null;

export const initializeFirebase = async () => {
    try {
        if (admin.apps.length > 0) {
            firebaseApp = admin.app();
            console.log("🔥 Firebase already initialized");
            return firebaseApp;
        }

        const serviceAccountPath =
            FIREBASE_SERVICE_ACCOUNT_PATH ||
            path.join(process.cwd(), "config/addressguru-uae-firebase-adminsdk-fbsvc-e0d2e2f060.json");

        console.log("Service Account Path:", serviceAccountPath);

        if (!fs.existsSync(serviceAccountPath)) {
            console.warn("⚠️ Firebase service account file not found");
            return null;
        }

        const serviceAccount = JSON.parse(
            fs.readFileSync(serviceAccountPath, "utf8")
        );

        firebaseApp = admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
        });

        // const token = await admin.credential.cert(serviceAccount).getAccessToken();
        // console.log("Access Token:", token);


        // const auth = new GoogleAuth({
        //     keyFile: path.join(process.cwd(), "config/addressguru-uae-firebase-adminsdk-fbsvc-e0d2e2f060.json"),
        //     scopes: ["https://www.googleapis.com/auth/firebase.messaging"],
        // });

        // const client = await auth.getClient();
        // console.log("Client:", client);

        // const clientAuth = await client.authorize();
        // console.log("Client Auth:", clientAuth);

        // const accessToken = await client.getAccessToken();
        // console.log("Access Token:", accessToken);

        // if (accessToken) {
        //     const response = await fetch(
        //         "https://fcm.googleapis.com/v1/projects/addressguru-uae/messages:send",
        //         {
        //             method: "POST",
        //             headers: {
        //                 Authorization: `Bearer ${accessToken?.token}`,
        //                 "Content-Type": "application/json",
        //             },
        //             body: JSON.stringify({
        //                 message: {
        //                     token: 'f5GeyMk2zU__kDelsXiIO2:APA91bFi8uqP8cNM3m1tiDxeTglOksI8LlSlV77STVd9XUNhhMBi7aMtshUB2zNgLmGJoB9ppBNTMzPBV2IyA_HSZuAufJXsV-t6WifrQLBOMoVSrn46Pnc',
        //                     notification: {
        //                         title: "Test Notification 🚀",
        //                         body: "Working via REST API",
        //                     },
        //                     data: {
        //                         type: "TEST",
        //                     },
        //                 },
        //             }),
        //         }
        //     );
        //     console.log("Response:", response);
        // }

        console.log("✅ 🔥🔥 Firebase initialized:", serviceAccount.project_id);
        return firebaseApp;
    } catch (error) {
        console.error("❌ Firebase init error:", error);
        return null;
    }
};

export const getFirebaseApp = () => firebaseApp;