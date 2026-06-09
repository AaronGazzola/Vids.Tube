import {
  Body,
  Button,
  Container,
  Font,
  Head,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import * as React from "react";
import { appName, theme } from "./_theme";

interface EmailLayoutProps {
  preview: string;
  heading: string;
  intro: string;
  buttonLabel: string;
  buttonUrl: string;
  outro?: string;
  footnote?: string;
}

export function EmailLayout({
  preview,
  heading,
  intro,
  buttonLabel,
  buttonUrl,
  outro,
  footnote,
}: EmailLayoutProps) {
  return (
    <Html lang="en">
      <Head>
        <Font
          fontFamily="Geist"
          fallbackFontFamily={["Helvetica", "Arial", "sans-serif"]}
          webFont={{
            url: "https://fonts.gstatic.com/s/geist/v3/gyB4hws1JdgnKy56GB_JX6zdREHmoNgY.woff2",
            format: "woff2",
          }}
          fontWeight={400}
          fontStyle="normal"
        />
      </Head>
      <Preview>{preview}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Section style={brandSection}>
            <Text style={brand}>{appName}</Text>
          </Section>
          <Section style={card}>
            <Text style={headingStyle}>{heading}</Text>
            <Text style={paragraph}>{intro}</Text>
            <Section style={buttonWrap}>
              <Button style={button} href={buttonUrl}>
                {buttonLabel}
              </Button>
            </Section>
            {outro ? <Text style={paragraph}>{outro}</Text> : null}
            <Text style={mutedSmall}>
              Or paste this link into your browser:
            </Text>
            <Link href={buttonUrl} style={linkStyle}>
              {buttonUrl}
            </Link>
          </Section>
          <Hr style={hr} />
          <Text style={footer}>
            {footnote
              ? footnote
              : "If you didn't request this email, you can safely ignore it."}
          </Text>
          <Text style={footerBrand}>{appName}</Text>
        </Container>
      </Body>
    </Html>
  );
}

const body = {
  backgroundColor: theme.muted,
  fontFamily: theme.fontFamily,
  margin: 0,
  padding: "24px 0",
};

const container = {
  maxWidth: "480px",
  margin: "0 auto",
  padding: "0 16px",
};

const brandSection = {
  padding: "8px 0 16px",
  textAlign: "center" as const,
};

const brand = {
  fontFamily: theme.fontFamily,
  fontSize: "20px",
  fontWeight: 600,
  letterSpacing: "-0.02em",
  color: theme.foreground,
  margin: 0,
};

const card = {
  backgroundColor: theme.card,
  border: `1px solid ${theme.border}`,
  borderRadius: theme.radius,
  padding: "32px",
  boxShadow: "0 1px 2px rgba(10, 10, 10, 0.04)",
};

const headingStyle = {
  fontFamily: theme.fontFamily,
  fontSize: "22px",
  fontWeight: 600,
  letterSpacing: "-0.01em",
  color: theme.foreground,
  margin: "0 0 12px",
};

const paragraph = {
  fontFamily: theme.fontFamily,
  fontSize: "15px",
  lineHeight: "24px",
  color: theme.foreground,
  margin: "0 0 20px",
};

const buttonWrap = {
  textAlign: "center" as const,
  margin: "8px 0 24px",
};

const button = {
  backgroundColor: theme.primary,
  color: theme.primaryForeground,
  fontFamily: theme.fontFamily,
  fontSize: "15px",
  fontWeight: 600,
  textDecoration: "none",
  borderRadius: theme.radius,
  padding: "12px 24px",
  display: "inline-block",
};

const mutedSmall = {
  fontFamily: theme.fontFamily,
  fontSize: "13px",
  lineHeight: "20px",
  color: theme.mutedForeground,
  margin: "0 0 4px",
};

const linkStyle = {
  fontFamily: theme.fontFamily,
  fontSize: "13px",
  lineHeight: "20px",
  color: theme.foreground,
  wordBreak: "break-all" as const,
};

const hr = {
  borderColor: theme.border,
  margin: "24px 0 16px",
};

const footer = {
  fontFamily: theme.fontFamily,
  fontSize: "13px",
  lineHeight: "20px",
  color: theme.mutedForeground,
  margin: "0 0 8px",
  textAlign: "center" as const,
};

const footerBrand = {
  fontFamily: theme.fontFamily,
  fontSize: "13px",
  fontWeight: 600,
  color: theme.mutedForeground,
  margin: 0,
  textAlign: "center" as const,
};
