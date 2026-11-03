export const events = [
  {
    id: 1,
    title: "Christmas Celebration",
    category: "Entertainment",
    description: "Enjoy festive activities, workshops, and a movie night.",
    startDate: "2026-12-23T12:00:00+02:00",
    location: "University Campus",
    capacity: 200,
    approvalMode: "MANUAL",
    imageUrl: "/images/christmas.jpg",
    ticketCategories: [
      { id: "general", name: "General Admission", price: 150, available: 160 },
      { id: "vip", name: "VIP", price: 300, available: 40 },
    ],
  },
  
  {
    id: 2,
    title: "Web Development Workshop",
    category: "Education",
    description: "Learn the basics of building websites with React.",
    startDate: "2026-12-05T10:00:00+02:00",
    location: "Computer Lab",
    capacity: 30,
    approvalMode: "AUTOMATIC",
    imageUrl: "/images/workshop.jpg",
    ticketCategories: [
      { id: "student", name: "Student Admission", price: 75, available: 20 },
      { id: "standard", name: "Standard Admission", price: 120, available: 10 },
    ],
  },
  {
    id: 3,
    title: "Sports Tournament",
    category: "Sports",
    description: "Join a day of team competitions and sporting activities.",
    startDate: "2026-12-10T09:00:00+02:00",
    location: "University Sports Courts",
    capacity: 100,
    approvalMode: "AUTOMATIC",
    imageUrl: "/images/sports1.jpg",
    ticketCategories: [
      { id: "general", name: "General Admission", price: 80, available: 80 },
      { id: "premium", name: "Premium Seating", price: 160, available: 20 },
    ],
  },
]