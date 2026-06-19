const PRIORITY_COUNTRIES = [
  "United States", "Chile", "Peru", "Argentina", "Bolivia",
  "Colombia", "Brazil", "Ecuador", "Mexico"
];

const ALL_COUNTRIES = [
  "Afghanistan","Albania","Algeria","Andorra","Angola","Antigua and Barbuda",
  "Argentina","Armenia","Australia","Austria","Azerbaijan","Bahamas","Bahrain",
  "Bangladesh","Barbados","Belarus","Belgium","Belize","Benin","Bhutan","Bolivia",
  "Bosnia and Herzegovina","Botswana","Brazil","Brunei","Bulgaria","Burkina Faso",
  "Burundi","Cabo Verde","Cambodia","Cameroon","Canada","Central African Republic",
  "Chad","Chile","China","Colombia","Comoros","Congo","Costa Rica","Croatia","Cuba",
  "Cyprus","Czech Republic","Denmark","Djibouti","Dominica","Dominican Republic",
  "Ecuador","Egypt","El Salvador","Equatorial Guinea","Eritrea","Estonia","Eswatini",
  "Ethiopia","Fiji","Finland","France","Gabon","Gambia","Georgia","Germany","Ghana",
  "Greece","Grenada","Guatemala","Guinea","Guinea-Bissau","Guyana","Haiti","Honduras",
  "Hungary","Iceland","India","Indonesia","Iran","Iraq","Ireland","Israel","Italy",
  "Jamaica","Japan","Jordan","Kazakhstan","Kenya","Kiribati","Kuwait","Kyrgyzstan",
  "Laos","Latvia","Lebanon","Lesotho","Liberia","Libya","Liechtenstein","Lithuania",
  "Luxembourg","Madagascar","Malawi","Malaysia","Maldives","Mali","Malta","Marshall Islands",
  "Mauritania","Mauritius","Mexico","Micronesia","Moldova","Monaco","Mongolia","Montenegro",
  "Morocco","Mozambique","Myanmar","Namibia","Nauru","Nepal","Netherlands","New Zealand",
  "Nicaragua","Niger","Nigeria","North Korea","North Macedonia","Norway","Oman","Pakistan",
  "Palau","Palestine","Panama","Papua New Guinea","Paraguay","Peru","Philippines","Poland",
  "Portugal","Qatar","Romania","Russia","Rwanda","Saint Kitts and Nevis","Saint Lucia",
  "Saint Vincent and the Grenadines","Samoa","San Marino","Sao Tome and Principe",
  "Saudi Arabia","Senegal","Serbia","Seychelles","Sierra Leone","Singapore","Slovakia",
  "Slovenia","Solomon Islands","Somalia","South Africa","South Korea","South Sudan","Spain",
  "Sri Lanka","Sudan","Suriname","Sweden","Switzerland","Syria","Taiwan","Tajikistan",
  "Tanzania","Thailand","Timor-Leste","Togo","Tonga","Trinidad and Tobago","Tunisia",
  "Turkey","Turkmenistan","Tuvalu","Uganda","Ukraine","United Arab Emirates",
  "United Kingdom","United States","Uruguay","Uzbekistan","Vanuatu","Vatican City",
  "Venezuela","Vietnam","Yemen","Zambia","Zimbabwe"
];

const OTHER_COUNTRIES = ALL_COUNTRIES.filter(c => !PRIORITY_COUNTRIES.includes(c)).sort();
export const COUNTRY_OPTIONS = [...PRIORITY_COUNTRIES, "---", ...OTHER_COUNTRIES];

export const INITIAL_CONTACT = { name: "", email: "", phone: "" };

export const INITIAL_FORM = {
  name: "",
  type: "international",
  country: "",
  billing_street: "",
  billing_city: "",
  billing_state: "",
  billing_postal_code: "",
  shipping_street: "",
  shipping_city: "",
  shipping_state: "",
  shipping_postal_code: "",
  shipping_country: "",
  primary_contact: { ...INITIAL_CONTACT },
  extra_contacts: [],
};

export function customerToForm(customer) {
  const contacts = Array.isArray(customer?.contacts) ? customer.contacts : [];
  const primaryIndex = contacts.findIndex(c => c.is_primary);
  const selectedPrimaryIndex = primaryIndex >= 0 ? primaryIndex : 0;
  const primary = contacts[selectedPrimaryIndex] || INITIAL_CONTACT;

  return {
    name: customer?.name || "",
    type: customer?.type || "international",
    country: customer?.country || "",
    billing_street: customer?.billing_street || "",
    billing_city: customer?.billing_city || "",
    billing_state: customer?.billing_state || "",
    billing_postal_code: customer?.billing_postal_code || "",
    shipping_street: customer?.shipping_street || "",
    shipping_city: customer?.shipping_city || "",
    shipping_state: customer?.shipping_state || "",
    shipping_postal_code: customer?.shipping_postal_code || "",
    shipping_country: customer?.shipping_country || "",
    primary_contact: {
      name: primary.name || "",
      email: primary.email || "",
      phone: primary.phone || "",
    },
    extra_contacts: contacts
      .filter((_, index) => index !== selectedPrimaryIndex)
      .map(contact => ({
        name: contact.name || "",
        email: contact.email || "",
        phone: contact.phone || "",
      })),
  };
}

export function formToPayload(form) {
  return {
    name: form.name,
    type: form.type,
    country: form.country,
    billing_street: form.billing_street || null,
    billing_city: form.billing_city || null,
    billing_state: form.billing_state || null,
    billing_postal_code: form.billing_postal_code || null,
    shipping_street: form.shipping_street || null,
    shipping_city: form.shipping_city || null,
    shipping_state: form.shipping_state || null,
    shipping_postal_code: form.shipping_postal_code || null,
    shipping_country: form.shipping_country || null,
    contacts: [
      { ...form.primary_contact, is_primary: true },
      ...form.extra_contacts.map(c => ({ ...c, is_primary: false }))
    ]
  };
}
