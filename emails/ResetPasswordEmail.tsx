// emails/ResetPasswordEmail.tsx
//
// Purpose:
// - React Email template for "Reset your password".
// - Clean, branded layout that works across Gmail/Outlook/Apple Mail.
//
// Usage:
// - Rendered via @react-email/render in lib/email/resendClient.ts.

import * as React from "react";
import {
  Html,
  Head,
  Preview,
  Body,
  Container,
  Section,
  Heading,
  Text,
  Button,
  Hr,
} from "@react-email/components";

interface ResetPasswordEmailProps {
  resetUrl: string;
  productName?: string;
  supportEmail?: string;
}

export default function ResetPasswordEmail({
  resetUrl,
  productName = "Your App",
  supportEmail = "support@example.com",
}: ResetPasswordEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Reset your password</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Section>
            <Heading as="h2" style={styles.heading}>
              Reset your password
            </Heading>
            <Text style={styles.text}>
              You recently requested to reset your password for your {productName} account.
              Click the button below to choose a new password. This link will expire in 60 minutes.
            </Text>

            <Section style={{ textAlign: "center", margin: "24px 0" }}>
              <Button href={resetUrl} style={styles.button}>
                Reset Password
              </Button>
            </Section>

            <Text style={styles.text}>
              If you didn’t request a password reset, you can safely ignore this email.
              If you have any questions, reply to this message or contact{" "}
              <strong>{supportEmail}</strong>.
            </Text>

            <Hr />
            <Text style={styles.footer}>
              © {new Date().getFullYear()} {productName}. All rights reserved.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

// Inline styles for broad client support
const styles = {
  body: {
    backgroundColor: "#f6f9fc",
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  } as React.CSSProperties,
  container: {
    backgroundColor: "#ffffff",
    margin: "40px auto",
    padding: "32px",
    borderRadius: "10px",
    boxShadow: "0 2px 7px rgba(0,0,0,0.06)",
    width: "100%",
    maxWidth: "520px",
  } as React.CSSProperties,
  heading: {
    margin: 0,
    fontSize: "22px",
    color: "#111827",
  } as React.CSSProperties,
  text: {
    fontSize: "14px",
    color: "#374151",
    lineHeight: "1.6",
  } as React.CSSProperties,
  button: {
    backgroundColor: "#2563EB",
    color: "#ffffff",
    padding: "12px 18px",
    borderRadius: "8px",
    textDecoration: "none",
    fontWeight: 700,
    display: "inline-block",
  } as React.CSSProperties,
  footer: {
    fontSize: "12px",
    color: "#9CA3AF",
    textAlign: "center",
  } as React.CSSProperties,
};
