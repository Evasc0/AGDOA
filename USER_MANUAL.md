# Agduwa Ride-Hailing App User Manual

## Table of Contents
1. [Introduction](#introduction)
2. [System Overview](#system-overview)
3. [Getting Started](#getting-started)
4. [Driver Guide](#driver-guide)
5. [Admin Guide](#admin-guide)
6. [Troubleshooting](#troubleshooting)
7. [Frequently Asked Questions](#frequently-asked-questions)

## Introduction

Welcome to **Agduwa**, a modern ride-hailing application designed to streamline transportation services in the Paradahan area. This manual provides comprehensive documentation for both drivers and administrators of the Agduwa platform.

### Purpose
This user manual serves as a complete guide for:
- New drivers joining the platform
- Administrators managing the system
- Understanding system workflows and features
- Troubleshooting common issues

### Key Features
- **Driver Registration & Verification**: Secure onboarding process
- **Real-time Queue Management**: Fair distribution of ride requests
- **GPS-based Location Tracking**: Geofencing for service area validation
- **Dynamic Fare Calculation**: Automated pricing based on destinations
- **Admin Dashboard**: Comprehensive management and analytics tools
- **Ride History & Analytics**: Performance tracking and reporting

## System Overview

### Architecture
Agduwa is built using modern web technologies:
- **Frontend**: React.js with TypeScript
- **Backend**: Firebase (Authentication & Firestore database)
- **Styling**: Tailwind CSS
- **Deployment**: Vercel

### User Roles
1. **Drivers**: Registered users who provide transportation services
2. **Admin**: System administrator with full platform control

### Core Components
- **Authentication System**: Secure login/registration
- **Queue System**: Manages driver availability and ride assignments
- **Geofencing**: Validates service area (Paradahan boundaries)
- **Fare Matrix**: Predefined pricing structure
- **Analytics Dashboard**: Performance metrics and reporting

## Getting Started

### Prerequisites
- Modern web browser (Chrome, Firefox, Safari, Edge)
- Stable internet connection
- Mobile device with GPS capabilities (recommended for drivers)
- Valid email address for registration

### Accessing the Application
1. Open your web browser
2. Navigate to the Agduwa application URL
3. The system will automatically redirect based on your authentication status

### Account Types
- **Driver Account**: For transportation service providers
- **Admin Account**: For system administrators (pre-configured)

## Driver Guide

### Registration Process

#### Step 1: Access Registration
1. Navigate to the application login page
2. Click on "Register" or "Don't have an account? Register"
3. Fill in the registration form with the following information:
   - Full Name
   - Email Address
   - Password (minimum 6 characters)
   - Plate Number (vehicle license plate)
   - Vehicle Type/Model
   - Phone Number (11 digits, e.g., 09123456789)

#### Step 2: Account Verification
- After registration, your account status will be "Pending"
- Wait for admin approval via email notification
- Once approved, you can log in to the system

#### Step 3: Profile Setup
After approval, complete your profile:
- Payment Method (GCash by default)
- Payment Number
- Age (optional)
- Additional contact information

### Logging In

#### For Approved Drivers
1. Enter your registered email and password
2. Click "Login"
3. System validates credentials and redirects to driver dashboard

#### For New/Pending Drivers
- Login attempts will show verification status
- Contact admin if approval is delayed

### Driver Dashboard Overview

#### Main Interface Elements
- **Welcome Message**: Displays driver name
- **Online/Offline Toggle**: Controls availability status
- **Ride Status**: Current activity (Waiting, In Ride, Offline)
- **Location Status**: GPS validation (Inside/Outside Paradahan)
- **Vehicle Information**: Plate number and vehicle type
- **Destination Selection**: Dropdown for ride destinations
- **Queue Information**: Position and estimated wait time

#### Status Indicators
- **Green**: Online and available
- **Yellow**: In queue or in ride
- **Red**: Offline or outside service area

### Going Online and Joining the Queue

#### Step 1: Enable Location Services
1. Ensure GPS is enabled on your device
2. Grant location permissions to the browser
3. Verify "Inside Paradahan" status

#### Step 2: Go Online
1. Click the "Go Online" button
2. System validates location
3. Status changes to "Online"

#### Step 3: Join Queue
- System automatically adds you to the queue
- Monitor your position in the queue
- Wait for your turn (position 1)

### Accepting and Starting Rides

#### When It's Your Turn
1. System displays "It's your turn! Get ready for a ride."
2. Select destination from the dropdown menu
3. Click "Start Ride" button
4. Status changes to "In Ride"

#### During the Ride
- Monitor ride status in real-time
- System tracks your location and ride progress
- Ride automatically completes after timeout or manual completion

### Managing Ride Status

#### Status Types
- **Offline**: Not available for rides
- **Waiting**: In queue, waiting for assignment
- **In Ride**: Currently servicing a passenger
- **Left Queue (In Ride)**: Ride in progress

#### Automatic Status Changes
- Leaving queue → "In Ride" (1-minute timer starts)
- Timer expires → Automatically "Offline"
- Manual status changes via dashboard buttons

### Viewing Ride History

#### Accessing History
1. Navigate to "History" tab
2. View completed rides with details:
   - Date and time
   - Destination
   - Fare earned
   - Ride status

#### History Features
- Chronological ordering (newest first)
- Filter options available
- Earnings summary

### Profile Management

#### Editing Profile Information
1. Go to "Profile" tab
2. Update personal information:
   - Name, contact details
   - Vehicle information
   - Payment method and number
3. Save changes

#### Password Reset
- Request password reset via admin
- Or contact system administrator

### Earnings and Analytics

#### Viewing Personal Analytics
1. Access "Analytics" tab
2. View performance metrics:
   - Total rides completed
   - Earnings summary
   - Ride frequency
   - Performance trends

#### Fare Calculation
- System uses predefined fare matrix
- Fares based on destination selection
- Automatic calculation and recording

## Admin Guide

### Admin Access

#### Login Process
1. Use designated admin email (agduwaadmin@gmail.com)
2. Enter admin password
3. System automatically redirects to admin dashboard

#### Admin Privileges
- Full driver management
- Queue manipulation
- System analytics access
- User verification control
- Activity logging

### Admin Dashboard Overview

#### Main Navigation Tabs
- **Drivers**: Manage verified drivers
- **Queue**: Control driver queue
- **Status**: View driver status overview
- **Logs**: Admin activity history
- **History**: Driver registration history
- **Pending**: Registration approvals
- **Analytics**: System-wide performance metrics

### Driver Management

#### Viewing All Drivers
1. Click "Drivers" tab
2. Search by name or plate number
3. View driver details in table format:
   - Name, plate, status, email
   - Action buttons for each driver

#### Driver Actions
- **Edit**: Modify driver information
- **Delete**: Remove driver from system
- **Reset Password**: Send password reset email
- **Add to Queue**: Manually add driver to queue
- **Remove from Queue**: Manually remove driver from queue

#### Editing Driver Information
1. Click "Edit" button for selected driver
2. Modify fields in the modal:
   - Personal information
   - Vehicle details
   - Contact information
   - Verification status
3. Save changes

### Queue Management

#### Viewing Current Queue
1. Click "Queue" tab
2. See ordered list of drivers in queue
3. Each entry shows:
   - Driver name and plate
   - Current status
   - Position in queue

#### Manual Queue Operations
- **Reorder Queue**: Drag and drop to change positions
- **Remove Driver**: Manually remove from queue
- **Add Driver**: Manually add offline driver to queue

### Registration Approval Process

#### Reviewing Pending Requests
1. Click "Pending" tab
2. View pending driver registrations
3. Review application details:
   - Personal information
   - Vehicle details
   - Contact information

#### Approval Actions
- **Approve**: Verify driver and grant access
- **Reject**: Delete registration request
- All actions are logged in admin activity logs

### System Analytics

#### Accessing Analytics
1. Click "Analytics" tab
2. View comprehensive system metrics
3. Filter by time periods:
   - Daily, Weekly, Monthly, Annually
   - Custom date ranges

#### Analytics Features
- **Overall Statistics**: Pie chart of driver earnings
- **Driver Performance**: Individual driver metrics
- **Total Rides**: System-wide ride count
- **Total Earnings**: Combined earnings summary
- **Performance Rankings**: Drivers sorted by earnings

#### Custom Filtering
1. Click "Custom" filter button
2. Select date range
3. Apply filters to view specific periods

### Activity Logging

#### Viewing Admin Logs
1. Click "Logs" tab
2. See chronological activity history
3. Each log entry includes:
   - Admin email
   - Action performed
   - Timestamp

#### Logged Actions
- Driver approvals/rejections
- Queue modifications
- Password resets
- Driver edits/deletions

### Driver History

#### Registration History
1. Click "History" tab
2. View all driver registrations
3. See registration timestamps
4. Access destination history

#### Destination History
- Click "View Destination History" button
- See chronological ride records
- Filter by driver or date
- Export options available

## Troubleshooting

### Common Driver Issues

#### Location Not Detected
**Problem**: "Outside Paradahan" status
**Solutions**:
1. Enable GPS on device
2. Grant browser location permissions
3. Ensure you're within service area
4. Refresh the page

#### Cannot Go Online
**Problem**: "Go Online" button disabled
**Solutions**:
1. Verify location status
2. Check internet connection
3. Ensure account is verified
4. Contact admin if issues persist

#### Queue Not Updating
**Problem**: Position not changing
**Solutions**:
1. Refresh the page
2. Check internet connection
3. Verify online status
4. Contact admin for queue issues

#### Ride Not Starting
**Problem**: "Start Ride" button not working
**Solutions**:
1. Ensure you're position 1 in queue
2. Select a destination
3. Check internet connection
4. Try refreshing the page

### Common Admin Issues

#### Cannot Access Admin Panel
**Problem**: Redirected to driver dashboard
**Solutions**:
1. Verify admin email address
2. Check account permissions
3. Contact system administrator

#### Analytics Not Loading
**Problem**: Analytics tab shows no data
**Solutions**:
1. Check internet connection
2. Verify Firebase connection
3. Refresh the page
4. Check date range filters

#### Driver Status Not Updating
**Problem**: Manual status changes not reflecting
**Solutions**:
1. Check Firestore permissions
2. Verify internet connection
3. Try again after a few seconds
4. Check browser console for errors

### Technical Issues

#### Page Not Loading
**Solutions**:
1. Clear browser cache
2. Try different browser
3. Check internet connection
4. Contact technical support

#### Authentication Errors
**Problem**: Login failures
**Solutions**:
1. Verify email and password
2. Check account verification status
3. Reset password if needed
4. Contact admin for account issues

#### GPS/Location Errors
**Problem**: Location services not working
**Solutions**:
1. Enable device GPS
2. Grant browser permissions
3. Try different device/browser
4. Check location settings

## Frequently Asked Questions

### General Questions

**Q: What is Agduwa?**
A: Agduwa is a ride-hailing application designed for transportation services in the Paradahan area, connecting drivers with passengers through an efficient queue-based system.

**Q: How does the queue system work?**
A: Drivers go online and join a queue. When a ride request comes in, the driver at position 1 gets assigned. The system ensures fair distribution of rides among available drivers.

**Q: What areas does Agduwa serve?**
A: Currently, Agduwa serves the Paradahan area. GPS validation ensures drivers are within the designated service zone.

**Q: How are fares calculated?**
A: Fares are calculated using a predefined fare matrix based on destination. The system automatically computes fares when drivers select their destination.

### Driver Questions

**Q: How long does account verification take?**
A: Account verification is typically processed within 24 hours. You'll receive a notification once approved.

**Q: Can I work from multiple devices?**
A: Yes, but it's recommended to use one device at a time to avoid status conflicts.

**Q: What happens if I lose internet connection during a ride?**
A: The system will attempt to reconnect. If connection is lost for too long, the ride may timeout and status will change accordingly.

**Q: How do I update my vehicle information?**
A: Contact your admin or use the profile editing feature if available.

**Q: Can I see my earnings in real-time?**
A: Yes, through the Analytics tab, you can view your ride history and earnings summary.

### Admin Questions

**Q: How do I add new drivers to the system?**
A: Drivers register through the app. You approve their registration in the "Pending" tab of the admin dashboard.

**Q: Can I manually assign rides to specific drivers?**
A: Yes, through queue management, you can reorder the queue or manually add/remove drivers.

**Q: How do I view system performance?**
A: Use the Analytics tab to view comprehensive metrics including driver performance, total rides, and earnings.

**Q: What should I do if a driver reports issues?**
A: Check their status in the admin panel, verify their location, and use the edit function to update their information if needed.

**Q: How do I reset a driver's password?**
A: Use the "Reset Password" button in the Drivers tab, which sends a password reset email to the driver.

### Technical Questions

**Q: What browsers are supported?**
A: Modern browsers including Chrome, Firefox, Safari, and Edge are fully supported.

**Q: Do I need a smartphone to use Agduwa?**
A: While a smartphone with GPS is recommended for drivers, the system works on any device with a modern web browser.

**Q: Is my data secure?**
A: Yes, Agduwa uses Firebase authentication and encrypted data storage to protect user information.

**Q: Can I export ride data?**
A: Currently, data can be viewed in the admin dashboard. Export functionality may be added in future updates.

**Q: What if I encounter a bug?**
A: Report the issue to the system administrator with details about what you were doing when the error occurred.

---

*For technical support or additional questions, please contact the system administrator.*

*Last updated: [Current Date]*
*Version: 1.0*
