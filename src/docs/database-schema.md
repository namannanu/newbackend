// title
title Event Management Platform - Complete Data Model

// define tables
Users [icon: user, color: yellow] {
  userId string pk
  FullName string
  email string unique
  password string
  phone string
  faceId string
  verificationStatus string "pending/verified/rejected"
  status string "active/inactive/banned"
  createdAt date
  updatedAt date
}

AdminUsers [icon: user-shield, color: yellow] {
  userId string pk
  email string unique
  password string
  role string "superadmin/eventadmin/support"
  permissions string[]
  status string "active/inactive"
  statusReason string
  lastActivity date
  lastLogin date
  activityLog array
  createdAt date
  updatedAt date
}

Events [icon: calendar, color: blue] {
  eventId string pk
  name string
  description string
  location string
  date date
  startTime string
  endTime string
  totalTickets number
  ticketsSold number computed
  ticketPrice number
  status string "draft/active/cancelled/completed"
  organiserId string
  createdAt date
  updatedAt date
  coverImage string
}

EventTicket [icon: ticket, color: orange] {
  ticketId string pk
  userId string
  eventId string
  registrationId string
  seatNumber string
  price number
  purchaseDate date
  checkInTime date nullable
  status string "active/used/refunded/void"
  faceVerified boolean
  bookedByAdminUserId string nullable
}

UserEventRegistrations [icon: check-circle, color: green] {
  registrationId string pk
  eventId string
  userId string
  registrationDate date
  status string "pending/verified/rejected"
  checkInTime date nullable
  waitingStatus string "queued/processing/complete"
  faceVerificationStatus string "pending/success/failed"
  ticketAvailabilityStatus string "pending/available/unavailable"
  verificationAttempts number default:0
  lastVerificationAttempt date nullable
  ticketIssued boolean default:false
  ticketIssuedDate date nullable
  adminBooked boolean default:false
  adminOverrideReason string nullable
}

FaceImage [icon: image, color: purple] {
  rekognitionId string pk
  fullName string
  imageUrl string
  encodingData string
  confidence number
  createdAt date
  updatedAt date
}

EventOrganiser [icon: briefcase, color: red] {
  organiserId string pk
  name string
  email string unique
  phone string
  address string
  website string nullable
  description string
  contactPerson string
  status string "active/inactive"
  joinDate date
  totalRevenue number default:0
  totalEvents number default:0
  activeEvents number default:0
}

Feedback [icon: message-square, color: pink] {
  feedbackId string pk
  userId string
  eventId string
  feedbackEntries array
  createdAt date
  updatedAt date
}

FeedbackEntry [icon: star, color: pink] {
  rating number min:1 max:5
  category string "event/logistics/organizer/other"
  subject string
  message string
  date date
  status string "new/processed/archived"
  helpful number default:0
  notHelpful number default:0
}

AdminActivityLog [icon: activity, color: orange] {
  logId string pk
  adminUserId string
  action string
  targetType string
  targetId string
  details object
  ipAddress string
  userAgent string
  timestamp date
}

SystemConfiguration [icon: settings, color: gray] {
  configId string pk
  maintenance object
  features object
  limits object
  security object
  updatedBy string
  updatedAt date
}

AuditLog [icon: shield-check, color: purple] {
  auditId string pk
  action string
  performedBy string
  performedByEmail string
  targetId string
  targetType string
  details object
  ipAddress string
  userAgent string
  timestamp date
}

DataExport [icon: download, color: green] {
  exportId string pk
  requestedBy string
  dataTypes array
  format string "csv/json/xml"
  dateRange object
  status string "pending/processing/completed/failed"
  downloadUrl string nullable
  expiresAt date
  createdAt date
}

// define relationships
Users.faceId > FaceImage.rekognitionId
EventTicket.userId > Users.userId
EventTicket.eventId > Events.eventId
EventTicket.registrationId > UserEventRegistrations.registrationId
EventTicket.bookedByAdminUserId > AdminUsers.userId

UserEventRegistrations.userId > Users.userId
UserEventRegistrations.eventId > Events.eventId
UserEventRegistrations.faceVerificationStatus > Users.verificationStatus
UserEventRegistrations.status > Users.status

Events.organiserId > EventOrganiser.organiserId
AdminUsers.userId > Users.userId

Feedback.userId > Users.userId
Feedback.eventId > Events.eventId
Feedback.feedbackEntries > FeedbackEntry
AdminActivityLog.adminUserId > AdminUsers.userId
SystemConfiguration.updatedBy > AdminUsers.userId
AuditLog.performedBy > AdminUsers.userId
DataExport.requestedBy > AdminUsers.userId

// business rules
rule "Ticket requires successful registration" {
  EventTicket.registrationId must be connected to UserEventRegistrations
  where UserEventRegistrations.status = "verified"
}

rule "Face verification required" {
  UserEventRegistrations.faceVerificationStatus must be "success"
  when UserEventRegistrations.ticketIssued = true
}

rule "Ticket availability required" {
  UserEventRegistrations.ticketAvailabilityStatus must be "available"
  when UserEventRegistrations.ticketIssued = true
}
// business rules
rule "Ticket requires successful registration" {
  EventTicket.registrationId must be connected to UserEventRegistrations
  where UserEventRegistrations.status = "verified"
}

rule "Face verification required" {
  UserEventRegistrations.faceVerificationStatus must be "success"
  when UserEventRegistrations.ticketIssued = true
}

rule "Ticket availability required" {
  UserEventRegistrations.ticketAvailabilityStatus must be "available"
  when UserEventRegistrations.ticketIssued = true
}
// status types
Users.status: [active, suspended]
Users.verificationStatus: [pending, verified, rejected]
AdminUsers.status: [active, suspended]
Events.status: [draft, published, ongoing, completed, cancelled]
EventTicket.status: [booked, checked_in, cancelled, refunded]
UserEventRegistrations.status: [registered, checked_in, cancelled]
EventOrganiser.status: [pending, active, suspended, rejected]
Feedback.status: [new, reviewed, resolved]
DataExport.status: [processing, completed, failed, expired]
