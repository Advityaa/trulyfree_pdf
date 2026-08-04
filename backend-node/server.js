import express from 'express';
import cors from 'cors';
import multer from 'multer';
import forge from 'node-forge';
import signpdf from '@signpdf/signpdf';
import { P12Signer } from '@signpdf/signer-p12';

const app = express();
app.use(cors());
const upload = multer({ storage: multer.memoryStorage() });

// 1. Generate Self-Signed Cert
app.post('/api/generate-cert', upload.none(), (req, res) => {
    try {
        const password = req.body.password || 'password';
        const commonName = req.body.commonName || 'TrulyFree PDF User';

        // Generate keypair
        const keys = forge.pki.rsa.generateKeyPair(2048);
        const cert = forge.pki.createCertificate();
        
        cert.publicKey = keys.publicKey;
        cert.serialNumber = '01';
        cert.validity.notBefore = new Date();
        cert.validity.notAfter = new Date();
        cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);

        const attrs = [{ name: 'commonName', value: commonName }];
        cert.setSubject(attrs);
        cert.setIssuer(attrs);

        // self-sign
        cert.sign(keys.privateKey);

        // create PKCS12
        const p12Asn1 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert], password, { generateLocalKeyId: true, endpoint: cert });
        const p12Der = forge.asn1.toDer(p12Asn1).getBytes();
        const p12Buffer = Buffer.from(p12Der, 'binary');

        res.set({
            'Content-Type': 'application/x-pkcs12',
            'Content-Disposition': 'attachment; filename="self_signed_cert.p12"'
        });
        res.send(p12Buffer);
    } catch (err) {
        console.error("Cert generation error:", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// 2. Sign PDF
app.post('/api/sign', upload.fields([{ name: 'pdf' }, { name: 'cert' }]), async (req, res) => {
    try {
        if (!req.files || !req.files.pdf || !req.files.cert) {
            return res.status(400).json({ success: false, error: "Missing PDF or Certificate file." });
        }
        
        const password = req.body.password || '';
        const pdfBuffer = req.files.pdf[0].buffer;
        const certBuffer = req.files.cert[0].buffer;

        // Ensure cert is loaded
        const signer = new P12Signer(certBuffer, { passphrase: password });
        
        // Sign PDF
        const signedPdf = await signpdf.default.sign(pdfBuffer, signer);
        
        res.set({
            'Content-Type': 'application/pdf',
            'Content-Disposition': 'attachment; filename="signed_document.pdf"'
        });
        res.send(signedPdf);
    } catch (err) {
        console.error("Signing error:", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

const PORT = process.env.PORT || 8001;
app.listen(PORT, () => {
    console.log(`Node signing service running on port ${PORT}`);
});
