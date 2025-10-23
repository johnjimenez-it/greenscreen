export const kioskConfig = {
  eventName: "Retro Arcade Night",
  price: 15,
  currency: "USD",
  maxPrints: 10,
  maxEmails: 5,
  backgrounds: [
    {
      id: "neon-city",
      name: "Neon City",
      image: "https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=800&q=80"
    },
    {
      id: "cosmic",
      name: "Cosmic Swirl",
      image: "https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?auto=format&fit=crop&w=800&q=80"
    },
    {
      id: "beach",
      name: "Sunset Beach",
      image: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80"
    },
    {
      id: "custom-placeholder",
      name: "Classic Stage",
      image: "https://images.unsplash.com/photo-1452587925148-ce544e77e70d?auto=format&fit=crop&w=800&q=80"
    }
  ],
  backgroundTheme: "Retro Remix",
  paymentMethods: ["Cash", "Tap to Pay", "Credit Card", "Debit Card"],
  deliveryMethods: ["Email", "Print Pickup", "Both"],
  numberOfPeopleOptions: [1, 2, 3, 4, 5, 6, 7, 8],
  defaultPrintOptions: [0, 1, 2, 3, 4],
  emailCounts: [0, 1, 2, 3, 4, 5],
  hotline: "1-800-555-4757",
  supportEmail: "support@greenscreenexpress.com"
};
