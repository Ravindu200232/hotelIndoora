import { Panel, PlainList } from '../index.jsx';

/** Exactly what stays on file, and with what taken out of it. */
export function KeptList() {
  return (
    <Panel as="section" aria-labelledby="kept-title">
      <h3 id="kept-title">What is kept</h3>
      <PlainList>
        <li>
          <span><b>Past bookings, kept for accounting</b></span>
          <span>
            They stay on file with the lead guest's name, contact phone number, guest email address and special requests
            removed, and the link to your account cleared.
          </span>
        </li>
        <li>
          <span><b>Payments, kept for accounting</b></span>
          <span>They stay with their amounts and their PayPal transaction IDs.</span>
        </li>
      </PlainList>
    </Panel>
  );
}
