// emails/StaffWelcomeEmail.tsx
//
// Purpose:
// - React Email template for "Welcome, you've been added as staff".
// - Includes:
//     • a friendly welcome message,
//     • the temporary password set by the owner/admin,
//     • a button linking to the login page,
//     • a reminder to change the password after first login.
//
// Usage:
// - Rendered via @react-email/render in lib/email/resendClient.ts
//   by sendStaffWelcomeEmail().

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

interface StaffWelcomeEmailProps {
  name?: string;
  temporaryPassword: string;
  loginUrl: string;
  productName?: string;
  supportEmail?: string;
}

export default function StaffWelcomeEmail({
  name,
  temporaryPassword,
  loginUrl,
  productName = "Your App",
  supportEmail = "support@example.com",
}: StaffWelcomeEmailProps) {
  const displayName = name && name.trim().length > 0 ? name : "there";

  return (
    <Html>
      <Head />
      <Preview>Your staff account details</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Section>
            <Heading as="h2" style={styles.heading}>
              Welcome to {productName}
            </Heading>

            <Text style={styles.text}>
              Hi {displayName},
            </Text>

            <Text style={styles.text}>
              You&apos;ve been added as a staff member for{" "}
              <strong>{productName}</strong>. Below are your temporary login
              details. You&apos;ll be asked to choose a new password the first
              time you sign in.
            </Text>

            <Section style={styles.infoBox}>
              <Text style={styles.infoLabel}>Login URL</Text>
              <Text style={styles.infoValue}>{loginUrl}</Text>

              <Text style={{ ...styles.infoLabel, marginTop: "12px" }}>
                Temporary password
              </Text>
              <Text style={styles.infoValue}>{temporaryPassword}</Text>
            </Section>

            <Section style={{ textAlign: "center", margin: "24px 0" }}>
              <Button href={loginUrl} style={styles.button}>
                Log in to your account
              </Button>
            </Section>

            <Text style={styles.text}>
              For security, please use this temporary password only to log in
              the first time. You&apos;ll be prompted to set a new password
              that only you know.
            </Text>

            <Text style={styles.text}>
              If you believe this email was sent to you in error, or if you
              have any questions, please contact{" "}
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
  infoBox: {
    borderRadius: "8px",
    backgroundColor: "#f3f4f6",
    padding: "16px",
    marginTop: "16px",
  } as React.CSSProperties,
  infoLabel: {
    fontSize: "12px",
    color: "#6b7280",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  } as React.CSSProperties,
  infoValue: {
    fontSize: "14px",
    color: "#111827",
    fontFamily: "monospace",
    marginTop: "4px",
    wordBreak: "break-all",
  } as React.CSSProperties,
  footer: {
    fontSize: "12px",
    color: "#9CA3AF",
    textAlign: "center",
  } as React.CSSProperties,
};
