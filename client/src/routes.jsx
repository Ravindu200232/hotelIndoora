/**
 * Every approved route, once.
 *
 * Paths, names, roles and the sign-in requirement are the specification's, and
 * the list is the same thirty routes as `.agentforge/prototype/routes.json`.
 *
 * `pageModule` names the page each phase builds and imports here; until that
 * phase lands, `Page` stays null and the route answers with a clearly-marked
 * foundation notice rather than pretending to be the finished screen.
 */
import { PendingPage, NotFoundPage } from './pages/NotFoundPage.jsx';
import { HomePage } from './pages/HomePage.jsx';
import { AvailableRoomsPage } from './pages/AvailableRoomsPage.jsx';
import { RoomTypePage } from './pages/RoomTypePage.jsx';
import { SignInPage } from './pages/SignInPage.jsx';
import { RegisterPage } from './pages/RegisterPage.jsx';
import { ConfirmEmailPage } from './pages/ConfirmEmailPage.jsx';
import { PaymentReceivedPage } from './pages/PaymentReceivedPage.jsx';
import { BookingDetailsPage } from './pages/BookingDetailsPage.jsx';
import { PaymentPage } from './pages/PaymentPage.jsx';
import { BookingConfirmedPage } from './pages/BookingConfirmedPage.jsx';
import { MyBookingsPage } from './pages/MyBookingsPage.jsx';
import { MyBookingPage } from './pages/MyBookingPage.jsx';
import { ChangeBookingPage } from './pages/ChangeBookingPage.jsx';
import { CancelBookingPage } from './pages/CancelBookingPage.jsx';
import { MyAccountPage } from './pages/MyAccountPage.jsx';
import { DeleteAccountPage } from './pages/DeleteAccountPage.jsx';
import { StaffDashboardPage } from './pages/StaffDashboardPage.jsx';
import { RoomTypesPage } from './pages/RoomTypesPage.jsx';
import { NewRoomTypePage } from './pages/NewRoomTypePage.jsx';
import { EditRoomTypePage } from './pages/EditRoomTypePage.jsx';
import { BlockedDatesPage } from './pages/BlockedDatesPage.jsx';
import { BlockRoomsPage } from './pages/BlockRoomsPage.jsx';
import { StaffBookingsPage } from './pages/StaffBookingsPage.jsx';
import { BookingRecordPage } from './pages/BookingRecordPage.jsx';
import { EditBookingPage } from './pages/EditBookingPage.jsx';
import { NewBookingForGuestPage } from './pages/NewBookingForGuestPage.jsx';
import { SendPaymentLinkPage } from './pages/SendPaymentLinkPage.jsx';
import { TeamPage } from './pages/TeamPage.jsx';
import { AddStaffMemberPage } from './pages/AddStaffMemberPage.jsx';
import { HotelDetailsPage } from './pages/HotelDetailsPage.jsx';

export const ROUTES = [
  { path: '/', name: 'Home', roles: ['visitor', 'guest', 'hotel_staff'], shell: 'public', pageModule: 'pages/HomePage.jsx', Page: HomePage },
  { path: '/rooms', name: 'Available Rooms', roles: ['visitor', 'guest', 'hotel_staff'], shell: 'public', pageModule: 'pages/AvailableRoomsPage.jsx', Page: AvailableRoomsPage },
  { path: '/rooms/:roomTypeId', name: 'Room Type', roles: ['visitor', 'guest', 'hotel_staff'], shell: 'public', pageModule: 'pages/RoomTypePage.jsx', Page: RoomTypePage },
  { path: '/login', name: 'Sign In', roles: ['visitor', 'guest', 'hotel_staff'], shell: 'auth', pageModule: 'pages/SignInPage.jsx', Page: SignInPage },
  { path: '/register', name: 'Create Account', roles: ['visitor'], shell: 'auth', pageModule: 'pages/RegisterPage.jsx', Page: RegisterPage },
  { path: '/confirm-email', name: 'Confirm Your Email', roles: ['visitor', 'guest'], shell: 'auth', pageModule: 'pages/ConfirmEmailPage.jsx', Page: ConfirmEmailPage },
  { path: '/bookings/:reference/paid', name: 'Payment Received', roles: ['visitor', 'guest', 'hotel_staff'], shell: 'public', pageModule: 'pages/PaymentReceivedPage.jsx', Page: PaymentReceivedPage },
  { path: '/bookings/new', name: 'Booking Details', roles: ['guest'], shell: 'guest', pageModule: 'pages/BookingDetailsPage.jsx', Page: BookingDetailsPage },
  { path: '/bookings/new/payment', name: 'Payment', roles: ['guest'], shell: 'guest', pageModule: 'pages/PaymentPage.jsx', Page: PaymentPage },
  { path: '/bookings/:reference/confirmed', name: 'Booking Confirmed', roles: ['guest'], shell: 'guest', pageModule: 'pages/BookingConfirmedPage.jsx', Page: BookingConfirmedPage },
  { path: '/my-bookings', name: 'My Bookings', roles: ['guest'], shell: 'guest', pageModule: 'pages/MyBookingsPage.jsx', Page: MyBookingsPage },
  { path: '/my-bookings/:bookingId', name: 'My Booking', roles: ['guest'], shell: 'guest', pageModule: 'pages/MyBookingPage.jsx', Page: MyBookingPage },
  { path: '/my-bookings/:bookingId/change', name: 'Change Booking', roles: ['guest'], shell: 'guest', pageModule: 'pages/ChangeBookingPage.jsx', Page: ChangeBookingPage },
  { path: '/my-bookings/:bookingId/cancel', name: 'Cancel Booking', roles: ['guest'], shell: 'guest', pageModule: 'pages/CancelBookingPage.jsx', Page: CancelBookingPage },
  { path: '/account', name: 'My Account', roles: ['guest'], shell: 'guest', pageModule: 'pages/MyAccountPage.jsx', Page: MyAccountPage },
  { path: '/account/delete', name: 'Delete My Account', roles: ['guest'], shell: 'guest', pageModule: 'pages/DeleteAccountPage.jsx', Page: DeleteAccountPage },
  { path: '/staff', name: 'Staff Dashboard', roles: ['hotel_staff'], shell: 'staff', pageModule: 'pages/StaffDashboardPage.jsx', Page: StaffDashboardPage },
  { path: '/staff/room-types', name: 'Room Types', roles: ['hotel_staff'], shell: 'staff', pageModule: 'pages/RoomTypesPage.jsx', Page: RoomTypesPage },
  { path: '/staff/room-types/new', name: 'New Room Type', roles: ['hotel_staff'], shell: 'staff', pageModule: 'pages/NewRoomTypePage.jsx', Page: NewRoomTypePage },
  { path: '/staff/room-types/:roomTypeId', name: 'Edit Room Type', roles: ['hotel_staff'], shell: 'staff', pageModule: 'pages/EditRoomTypePage.jsx', Page: EditRoomTypePage },
  { path: '/staff/room-types/:roomTypeId/blocks', name: 'Blocked Dates', roles: ['hotel_staff'], shell: 'staff', pageModule: 'pages/BlockedDatesPage.jsx', Page: BlockedDatesPage },
  { path: '/staff/room-types/:roomTypeId/blocks/new', name: 'Block Rooms', roles: ['hotel_staff'], shell: 'staff', pageModule: 'pages/BlockRoomsPage.jsx', Page: BlockRoomsPage },
  { path: '/staff/bookings', name: 'Bookings', roles: ['hotel_staff'], shell: 'staff', pageModule: 'pages/StaffBookingsPage.jsx', Page: StaffBookingsPage },
  { path: '/staff/bookings/:bookingId', name: 'Booking Record', roles: ['hotel_staff'], shell: 'staff', pageModule: 'pages/BookingRecordPage.jsx', Page: BookingRecordPage },
  { path: '/staff/bookings/:bookingId/edit', name: 'Edit Booking', roles: ['hotel_staff'], shell: 'staff', pageModule: 'pages/EditBookingPage.jsx', Page: EditBookingPage },
  { path: '/staff/bookings/new', name: 'New Booking for a Guest', roles: ['hotel_staff'], shell: 'staff', pageModule: 'pages/NewBookingForGuestPage.jsx', Page: NewBookingForGuestPage },
  { path: '/staff/bookings/new/payment', name: 'Send Payment Link', roles: ['hotel_staff'], shell: 'staff', pageModule: 'pages/SendPaymentLinkPage.jsx', Page: SendPaymentLinkPage },
  { path: '/staff/team', name: 'Team', roles: ['hotel_staff'], shell: 'staff', pageModule: 'pages/TeamPage.jsx', Page: TeamPage },
  { path: '/staff/team/new', name: 'Add Staff Member', roles: ['hotel_staff'], shell: 'staff', pageModule: 'pages/AddStaffMemberPage.jsx', Page: AddStaffMemberPage },
  { path: '/staff/hotel', name: 'Hotel Details', roles: ['hotel_staff'], shell: 'staff', pageModule: 'pages/HotelDetailsPage.jsx', Page: HotelDetailsPage },
];

/** The navigation a shell shows, in the prototype's own order. */
export const NAV = {
  public: [
    { label: 'Home', to: '/' },
    { label: 'Rooms', to: '/rooms' },
  ],
  guest: [
    { label: 'My Bookings', to: '/my-bookings' },
    { label: 'Book a room', to: '/' },
    { label: 'My Account', to: '/account' },
  ],
  staff: [
    { label: 'Dashboard', to: '/staff' },
    { label: 'Room Types', to: '/staff/room-types' },
    { label: 'Bookings', to: '/staff/bookings' },
    { label: 'Team', to: '/staff/team' },
    { label: 'Hotel Details', to: '/staff/hotel' },
  ],
};

export { PendingPage, NotFoundPage };
