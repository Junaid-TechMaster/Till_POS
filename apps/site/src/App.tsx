import { PRODUCT_NAME } from "@tillpro/shared";
import { useEffect, useState } from "react";

interface Release {
  version: string;
  released: string;
  file: string;
  url: string;
  notes: string;
}

interface ReleaseList {
  latest: string;
  versions: Release[];
}

const controls = [
  ["Cash and card", "Cash uses the number pad or the £5, £10, £20 and £50 keys. Card is its own key. The change stays on screen until the next sale."],
  ["No VAT", "One key removes the VAT from the prices on that sale. The next sale goes back to the normal VAT rates."],
  ["Barcode, PLU, and price check", "Scan a barcode or type a PLU to add a product. Price check looks a product up without putting it in the basket."],
  ["Manual item", "Type a name, a price, a quantity, and a VAT rate on the till’s own keypad when the product is not in the catalogue. Stock is not changed."],
  ["Discounts and price override", "Discount one line or the whole basket. Override a price when the shop allows it."],
  ["Void", "Remove one line or empty the basket. A void above the shop’s limit asks for the admin password."],
  ["Hold and recall", "Park a basket and bring it back when the customer returns."],
  ["Refunds", "Refund a previous sale. The receipt and the reports show it separately from sales."],
  ["Customers", "Attach a customer to the sale. The shop can keep a short customer list on the till."],
  ["Petty cash and no sale", "Record cash paid in or out. No sale opens the drawer without a transaction."],
  ["Transactions and print last", "Look back through the slips from this till and print the last receipt again."],
  ["Reports and cash up", "See sales for the open day. Cash up compares the drawer with the till before the day is closed."],
  ["Day end", "The till emails that day’s transactions to the shop’s address, then closes the day. The next sale starts a new day."],
  ["Stock", "Each product can track a quantity. The stock screen shows what is low and records an adjustment."],
  ["Staff sign-in", "The shop signs in with its email and password. The cashier then signs in with an ID and a PIN. Forgetting the PIN is fixed by the admin, without the old PIN."],
  ["Updates", "Settings and Extras include Check for updates. If a newer installer is listed, Download update opens it. Installing it keeps that shop’s products and sales."],
];

const features = [
  {
    title: "A sale screen built for the counter",
    image: "/screenshots/sale.png",
    alt: "TillPro sale screen with categories, a basket, and cash buttons",
    copy: "The till opens on a touch sale screen. Categories fill the middle, the basket stays on the left, and cash, card, and the number pad stay under the right hand.",
    points: [
      "Type a price, then tap a category and a product. The product is sold at that price.",
      "Cash, card, and quick cash amounts. The change is shown before the next sale.",
      "No VAT removes the VAT from the prices on that sale.",
      "Clear empties the basket. The cross removes one line.",
    ],
  },
  {
    title: "Each shop keeps its own products",
    image: "/screenshots/catalogue.png",
    alt: "TillPro products inside the Fruit and Veg category",
    copy: "A new shop starts with an empty till. The admin and cashier add the categories and products. Another shop on the same computer does not see them.",
    points: [
      "Categories have a name, a colour, and an optional picture.",
      "Products have a barcode, PLU, price, VAT rate, and stock.",
      "Search by name, barcode, or PLU.",
      "The catalogue stays on that shop’s computer.",
    ],
  },
  {
    title: "Staff, stock, and the end of the day",
    image: "/screenshots/staff.png",
    alt: "TillPro staff screen where the admin sets a cashier PIN",
    copy: "The shop signs in with its email and password. That account is the till admin. The admin adds one cashier. At the end of the day the till can email that day’s transactions to the shop.",
    points: [
      "The cashier signs in with an ID and a PIN.",
      "If the cashier forgets the PIN, the admin sets a new one. The old PIN is not required.",
      "Stock levels, low stock, and adjustments.",
      "Day end lists every transaction since the shop opened and closes the day.",
    ],
  },
];

export function App() {
  const [releases, setReleases] = useState<ReleaseList | null>(null);

  useEffect(() => {
    void fetch("/releases.json")
      .then((response) => response.json())
      .then((body: ReleaseList) => setReleases(body))
      .catch(() => setReleases(null));
  }, []);

  const latest = releases?.versions.find((item) => item.version === releases.latest) ?? releases?.versions[0];

  return (
    <>
      <header className="nav">
        <a className="brand" href="#top">{PRODUCT_NAME}</a>
        <nav className="nav-links">
          <a href="#features">Features</a>
          <a href="#pricing">Pricing</a>
          <a href="#download">Download</a>
          <a href="#contact">Contact</a>
        </nav>
      </header>

      <main id="top">
        <section className="hero">
          <div>
            <p className="kicker">Windows till for independent shops</p>
            <h1>Sell from a touch screen. Keep every shop separate.</h1>
            <p className="lede">
              {PRODUCT_NAME} is the till a shop installs on its computer. The shop signs in, then the cashier signs in. Products, sales, and staff stay on that computer.
            </p>
            <div className="hero-actions">
              {latest ? <a className="button gold" href={latest.url}>Download {latest.file}</a> : <a className="button gold" href="#download">Download the till</a>}
              <a className="button ghost" href="#features">See the features</a>
            </div>
          </div>
          <figure className="shot">
            <img src="/screenshots/sale.png" alt="TillPro sale screen" />
            <figcaption>The sale screen: categories, basket, and payment keys.</figcaption>
          </figure>
        </section>

        <section id="features">
          <h2>What the till does</h2>
          <p className="section-intro">Every control the shop uses during the day is on the till.</p>
          <div className="features">
            {features.map((feature, index) => (
              <article className={index % 2 ? "feature reverse" : "feature"} key={feature.title}>
                <div className="copy">
                  <h3>{feature.title}</h3>
                  <p>{feature.copy}</p>
                  <ul>
                    {feature.points.map((point) => <li key={point}>{point}</li>)}
                  </ul>
                </div>
                <img src={feature.image} alt={feature.alt} />
              </article>
            ))}
          </div>
          <div className="controls">
            {controls.map(([title, copy]) => (
              <article key={title}>
                <h3>{title}</h3>
                <p>{copy}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="pricing">
          <h2>Pricing</h2>
          <p className="section-intro">One price for one shop. The shop can use the till on the computers allowed for that shop.</p>
          <div className="prices">
            <article className="price">
              <p className="kicker">Monthly</p>
              <p className="amount">£29 <span>/ month</span></p>
              <ul>
                <li>The Windows till for that shop</li>
                <li>Products, sales, and staff stored on their computer</li>
                <li>Sign-in checked with your server</li>
                <li>Day-end email of that day’s transactions</li>
              </ul>
            </article>
            <article className="price featured">
              <p className="kicker">Yearly</p>
              <p className="amount">£290 <span>/ year</span></p>
              <ul>
                <li>The same till, paid once for the year</li>
                <li>Two months included compared with paying monthly</li>
                <li>Updates listed on this page and inside the till</li>
                <li>The five newest installers stay on this page</li>
              </ul>
            </article>
          </div>
        </section>

        <section id="download">
          <h2>Download the till</h2>
          <p className="section-intro">The five newest installers are listed here. Install the latest file, then sign in with the shop email or username and password. Windows may ask before it runs an installer that is not signed. Choose to run it. An installed till can also open Settings and press Check for updates.</p>
          <div className="downloads">
            {(releases?.versions ?? []).slice(0, 5).map((item) => (
              <article className="release" key={item.version}>
                <strong>
                  {item.version}
                  {item.version === releases?.latest ? <span className="badge">Latest</span> : null}
                </strong>
                <div>
                  <div>{item.file}</div>
                  <p>{item.released}. {item.notes}</p>
                </div>
                <a className="button teal" href={item.url}>Download</a>
              </article>
            ))}
          </div>
        </section>

        <section id="contact">
          <h2>Contact</h2>
          <p className="section-intro">These details are placeholders until the published phone number and email are ready.</p>
          <div className="contact">
            <dl>
              <dt>Phone</dt>
              <dd><a href="tel:+448001234567">0800 123 4567</a></dd>
              <dt>Email</dt>
              <dd><a href="mailto:hello@tillpro.example">hello@tillpro.example</a></dd>
            </dl>
            <dl>
              <dt>Address</dt>
              <dd>12 Market Street<br />Manchester<br />M1 1AE</dd>
            </dl>
          </div>
        </section>
      </main>

      <footer>
        <span>{PRODUCT_NAME}</span>
        <span>Windows till for independent shops.</span>
      </footer>
    </>
  );
}
