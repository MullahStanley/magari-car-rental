import { format, parseISO } from "date-fns";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { EMAIL_FROM, SUPPORT_EMAIL, resend } from "@/lib/resend";
import { formatCurrency } from "@/lib/utils";
import type { BookingWithVehicle, BookingStatus } from "@/types/database";

type EmailKind = "confirmed" | "declined" | "cancelled";

const SUBJECTS: Record<EmailKind, string> = {
  confirmed: "Your Magari booking is confirmed 🎉",
  declined: "Update on your Magari booking request",
  cancelled: "Your Magari booking has been cancelled",
};

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

interface BookingEmailData {
  id: string;
  vehicleName: string;
  vehicleBrand: string;
  startDate: string;
  endDate: string;
  totalPrice: number;
}

function buildEmailHtml(kind: EmailKind, booking: BookingEmailData): string {
  const isConfirmed = kind === "confirmed";
  const accent = isConfirmed ? "#16a34a" : "#dc2626";
  const headline = isConfirmed
    ? "Your booking is confirmed!"
    : kind === "declined"
      ? "Booking request declined"
      : "Booking cancelled";

  const body = isConfirmed
    ? `Great news — your rental of the <strong>${esc(booking.vehicleBrand)} ${esc(booking.vehicleName)}</strong> has been confirmed. Our team will reach out shortly with pickup details.`
    : kind === "declined"
      ? `Unfortunately, your booking request for the <strong>${esc(booking.vehicleBrand)} ${esc(booking.vehicleName)}</strong> could not be accommodated at this time. The dates are now free for you to try again, or contact us and we'll find you the perfect ride.`
      : `Your booking of the <strong>${esc(booking.vehicleBrand)} ${esc(booking.vehicleName)}</strong> has been cancelled. If this wasn't expected, please get in touch and we'll sort it out right away.`;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const bookingsUrl = `${appUrl}/bookings`;

  return `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:0;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;">
            <!-- Brand -->
            <tr>
              <td align="center" style="padding-bottom:20px;">
                <span style="font-size:20px;font-weight:700;color:#1e293b;">🚗 Magari Car Rental</span>
              </td>
            </tr>
            <!-- Card -->
            <tr>
              <td style="background-color:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;">
                <!-- Accent bar -->
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td height="6" style="background-color:${accent};font-size:0;line-height:0;">&nbsp;</td>
                  </tr>
                </table>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding:32px 32px 8px;">
                      <h1 style="margin:0 0 8px;font-size:24px;color:#0f172a;">${headline}</h1>
                      <p style="margin:0;font-size:15px;line-height:1.6;color:#475569;">${body}</p>
                    </td>
                  </tr>
                  <!-- Booking details -->
                  <tr>
                    <td style="padding:24px 32px;">
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;">
                        <tr>
                          <td style="padding:16px 20px;">
                            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                              <tr>
                                <td style="padding:4px 0;font-size:13px;color:#64748b;">Vehicle</td>
                                <td align="right" style="padding:4px 0;font-size:14px;font-weight:600;color:#0f172a;">${esc(booking.vehicleBrand)} ${esc(booking.vehicleName)}</td>
                              </tr>
                              <tr>
                                <td style="padding:4px 0;font-size:13px;color:#64748b;">Rental dates</td>
                                <td align="right" style="padding:4px 0;font-size:14px;font-weight:600;color:#0f172a;">${format(parseISO(booking.startDate), "MMM d")} – ${format(parseISO(booking.endDate), "MMM d, yyyy")}</td>
                              </tr>
                              <tr>
                                <td style="padding:4px 0;font-size:13px;color:#64748b;">Total</td>
                                <td align="right" style="padding:4px 0;font-size:14px;font-weight:600;color:#0f172a;">${formatCurrency(booking.totalPrice)}</td>
                              </tr>
                              <tr>
                                <td style="padding:4px 0;font-size:13px;color:#64748b;">Booking ref</td>
                                <td align="right" style="padding:4px 0;font-size:12px;color:#64748b;">${esc(booking.id.slice(0, 8))}</td>
                              </tr>
                            </table>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <!-- CTA -->
                  <tr>
                    <td align="center" style="padding:8px 32px 32px;">
                      <a href="${bookingsUrl}" style="display:inline-block;background-color:#2563eb;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:12px 28px;border-radius:10px;">View My Bookings</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <!-- Footer -->
            <tr>
              <td align="center" style="padding:20px 16px 0;font-size:12px;color:#94a3b8;line-height:1.6;">
                Questions? Reply to this email or contact <a href="mailto:${SUPPORT_EMAIL}" style="color:#64748b;">${SUPPORT_EMAIL}</a><br/>
                Magari Car Rental
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function resolveKind(
  newStatus: BookingStatus,
  previousStatus?: BookingStatus
): EmailKind | null {
  // No-op status change (e.g. a stale button click) — don't email anyone.
  if (previousStatus === newStatus) return null;
  if (newStatus === "confirmed") return "confirmed";
  if (newStatus === "cancelled") {
    // Declined = the admin turned down a pending request; cancelled = a
    // previously-confirmed rental was cancelled.
    return previousStatus === "pending" ? "declined" : "cancelled";
  }
  return null;
}

interface BookingStatusEmailInput {
  bookingId: string;
  newStatus: BookingStatus;
  previousStatus?: BookingStatus;
  /**
   * Pass a service-role client when there is no user session (e.g. from a
   * webhook) so the booking row can still be read past RLS. Defaults to the
   * request-scoped client for normal server actions.
   */
  client?: SupabaseClient;
}

/**
 * Fetches the booking + customer email and sends a status notification.
 * Never throws — email failures are logged so a broken email setup can't
 * block an admin's status change.
 */
export async function sendBookingStatusEmail({
  bookingId,
  newStatus,
  previousStatus,
  client,
}: BookingStatusEmailInput): Promise<void> {
  try {
    if (!resend) {
      console.warn(
        "RESEND_API_KEY is not configured — skipping booking status email."
      );
      return;
    }

    const kind = resolveKind(newStatus, previousStatus);
    if (!kind) return;

    const supabase = client ?? (await createClient());
    const { data: booking, error } = await supabase
      .from("bookings")
      .select(
        `*,
         vehicles (name, brand, category, daily_rate, image_url)`
      )
      .eq("id", bookingId)
      .single();

    if (error || !booking) {
      console.error("Booking status email: booking not found", bookingId);
      return;
    }

    const serviceClient = createServiceClient();
    const {
      data: { user },
      error: userError,
    } = await serviceClient.auth.admin.getUserById(booking.user_id);

    if (userError || !user?.email) {
      console.error("Booking status email: could not resolve user email", {
        bookingId,
        userError: userError?.message,
      });
      return;
    }

    const typed = booking as BookingWithVehicle;

    const { error: sendError } = await resend.emails.send({
      from: EMAIL_FROM,
      to: user.email,
      replyTo: SUPPORT_EMAIL,
      subject: SUBJECTS[kind],
      html: buildEmailHtml(kind, {
        id: booking.id,
        vehicleName: typed.vehicles.name,
        vehicleBrand: typed.vehicles.brand,
        startDate: booking.start_date,
        endDate: booking.end_date,
        totalPrice: booking.total_price,
      }),
    });

    if (sendError) {
      // e.g. "domain not verified" — log it loudly so the owner can act.
      console.error("Resend booking email failed:", sendError);
    }
  } catch (err) {
    console.error("Failed to send booking status email:", err);
  }
}
