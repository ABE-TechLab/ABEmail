import type { EmailDesignBlock } from "./render.mjs";

export type EmailDesignStarter = {
  value: string;
  label: string;
  subject: string;
  blocks: EmailDesignBlock[];
};

const STARTERS: EmailDesignStarter[] = [
  {
    value: "welcome", label: "Welcome email", subject: "Welcome aboard",
    blocks: [
      { id: "welcome-logo", type: "logo", src: null, alt: "", width: 160 },
      { id: "welcome-heading", type: "heading", level: 1, text: "Welcome to the team", align: "center" },
      { id: "welcome-copy", type: "paragraph", text: "We’re delighted to work with you. Here is what you can expect next." },
      { id: "welcome-cta", type: "button", label: "Get started", href: "https://example.com/get-started", align: "center" },
      { id: "welcome-footer", type: "footer", text: "Have a question? Reply to this email and we’ll be happy to help." },
    ],
  },
  {
    value: "invoice", label: "Invoice email", subject: "Your invoice is ready",
    blocks: [
      { id: "invoice-heading", type: "heading", level: 1, text: "Your invoice is ready" },
      { id: "invoice-copy", type: "paragraph", text: "Hello, your invoice is ready to review. Please use the secure link below to view the details and payment instructions." },
      { id: "invoice-row", type: "row", columns: [
        { id: "invoice-number-col", blocks: [{ id: "invoice-number-label", type: "heading", level: 3, text: "INVOICE NUMBER" }, { id: "invoice-number", type: "paragraph", text: "INV-0001" }] },
        { id: "invoice-amount-col", blocks: [{ id: "invoice-amount-label", type: "heading", level: 3, text: "AMOUNT DUE" }, { id: "invoice-amount", type: "paragraph", text: "Enter amount" }] },
      ] },
      { id: "invoice-cta", type: "button", label: "View invoice", href: "https://example.com/invoice", align: "center" },
      { id: "invoice-footer", type: "footer", text: "If you have questions about this invoice, please contact our team." },
    ],
  },
  {
    value: "payment-reminder", label: "Payment reminder", subject: "A friendly reminder about your payment",
    blocks: [
      { id: "payment-heading", type: "heading", level: 1, text: "Payment reminder" },
      { id: "payment-copy", type: "paragraph", text: "This is a friendly reminder that the payment below is due. Please review the details and contact us if you need help." },
      { id: "payment-details", type: "row", columns: [
        { id: "payment-due-col", blocks: [{ id: "payment-due-label", type: "heading", level: 3, text: "DUE DATE" }, { id: "payment-due-date", type: "paragraph", text: "Add due date" }] },
        { id: "payment-amount-col", blocks: [{ id: "payment-amount-label", type: "heading", level: 3, text: "AMOUNT" }, { id: "payment-amount", type: "paragraph", text: "Add amount" }] },
      ] },
      { id: "payment-cta", type: "button", label: "Review payment", href: "https://example.com/payment", align: "center" },
      { id: "payment-footer", type: "footer", text: "If you have already paid, please disregard this reminder." },
    ],
  },
  {
    value: "quotation", label: "Quotation", subject: "Your quotation is ready",
    blocks: [
      { id: "quote-heading", type: "heading", level: 1, text: "Your quotation is ready" },
      { id: "quote-copy", type: "paragraph", text: "Thank you for the opportunity to provide a quote. Review the proposed scope, pricing, and terms using the link below." },
      { id: "quote-expiry", type: "paragraph", text: "Quotation reference: QT-0001\nValid until: Add date" },
      { id: "quote-cta", type: "button", label: "View quotation", href: "https://example.com/quotation", align: "center" },
      { id: "quote-footer", type: "footer", text: "Reply to this email if you would like us to clarify or revise the quotation." },
    ],
  },
  {
    value: "order-confirmation", label: "Order confirmation", subject: "We’ve received your order",
    blocks: [
      { id: "order-heading", type: "heading", level: 1, text: "Thank you for your order" },
      { id: "order-copy", type: "paragraph", text: "Your order has been received. Keep this email for your records; we’ll share updates as it moves forward." },
      { id: "order-details", type: "row", columns: [
        { id: "order-number-col", blocks: [{ id: "order-number-label", type: "heading", level: 3, text: "ORDER NUMBER" }, { id: "order-number", type: "paragraph", text: "ORD-0001" }] },
        { id: "order-date-col", blocks: [{ id: "order-date-label", type: "heading", level: 3, text: "ORDER DATE" }, { id: "order-date", type: "paragraph", text: "Add date" }] },
      ] },
      { id: "order-cta", type: "button", label: "View order", href: "https://example.com/order", align: "center" },
      { id: "order-footer", type: "footer", text: "Need help? Reply to this message and our team will assist you." },
    ],
  },
  {
    value: "follow-up", label: "Customer follow-up", subject: "Following up",
    blocks: [
      { id: "follow-heading", type: "heading", level: 1, text: "Just following up" },
      { id: "follow-copy", type: "paragraph", text: "Hello, I wanted to check in and see whether you had any questions or need any additional information from our side." },
      { id: "follow-cta", type: "button", label: "Book a conversation", href: "https://example.com/contact", align: "center" },
      { id: "follow-footer", type: "footer", text: "Thank you for your time." },
    ],
  },
  {
    value: "newsletter", label: "Newsletter", subject: "Your latest update",
    blocks: [
      { id: "newsletter-logo", type: "logo", src: null, alt: "", width: 160 },
      { id: "newsletter-heading", type: "heading", level: 1, text: "The latest from our team", align: "center" },
      { id: "newsletter-intro", type: "paragraph", text: "A short introduction to the most important updates in this edition." },
      { id: "newsletter-divider", type: "divider" },
      { id: "newsletter-section", type: "heading", level: 2, text: "What’s new" },
      { id: "newsletter-copy", type: "paragraph", text: "Share a useful story, product update, or insight with your readers." },
      { id: "newsletter-cta", type: "button", label: "Read more", href: "https://example.com/news", align: "center" },
      { id: "newsletter-social", type: "social", links: [{ label: "Website", href: "https://example.com" }, { label: "LinkedIn", href: "https://www.linkedin.com" }] },
    ],
  },
  {
    value: "announcement", label: "Announcement", subject: "An important update from our team",
    blocks: [
      { id: "announcement-heading", type: "heading", level: 1, text: "An important announcement", align: "center" },
      { id: "announcement-copy", type: "paragraph", text: "Share the update clearly, explain who it affects, and outline any next steps." },
      { id: "announcement-divider", type: "divider" },
      { id: "announcement-detail", type: "paragraph", text: "Add the effective date, relevant details, or a short timeline here." },
      { id: "announcement-cta", type: "button", label: "Learn more", href: "https://example.com/announcement", align: "center" },
    ],
  },
  {
    value: "meeting-confirmation", label: "Meeting confirmation", subject: "Your meeting is confirmed",
    blocks: [
      { id: "meeting-heading", type: "heading", level: 1, text: "Your meeting is confirmed" },
      { id: "meeting-copy", type: "paragraph", text: "Thank you for booking time with us. Here are the details for your upcoming meeting." },
      { id: "meeting-details", type: "row", columns: [
        { id: "meeting-date-col", blocks: [{ id: "meeting-date-label", type: "heading", level: 3, text: "DATE & TIME" }, { id: "meeting-date", type: "paragraph", text: "Add date and time" }] },
        { id: "meeting-location-col", blocks: [{ id: "meeting-location-label", type: "heading", level: 3, text: "LOCATION" }, { id: "meeting-location", type: "paragraph", text: "Add location or meeting link" }] },
      ] },
      { id: "meeting-cta", type: "button", label: "View meeting details", href: "https://example.com/meeting", align: "center" },
      { id: "meeting-footer", type: "footer", text: "Need to make a change? Reply to this email and let us know." },
    ],
  },
];

export const EMAIL_DESIGN_STARTERS: readonly EmailDesignStarter[] = Object.freeze(STARTERS);

export function createEmailDesignStarter(value: string, makeId: () => string): EmailDesignStarter | null {
  const starter = STARTERS.find((item) => item.value === value);
  if (!starter) return null;
  const cloneBlock = (block: EmailDesignBlock): EmailDesignBlock => {
    if (block.type === "row") {
      return {
        ...block,
        id: makeId(),
        columns: block.columns.map((column) => ({
          id: makeId(),
          blocks: column.blocks.map(cloneBlock),
        })),
      };
    }
    return { ...block, id: makeId() } as EmailDesignBlock;
  };
  return { ...starter, blocks: starter.blocks.map(cloneBlock) };
}
