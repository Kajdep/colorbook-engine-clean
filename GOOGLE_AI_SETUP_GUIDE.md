# 🔧 Google AI Setup Guide for ColorBook Engine

## Complete Step-by-Step Instructions for Google Imagen Integration

### 📋 **Prerequisites**
- Google account
- Credit card for Google Cloud billing (required even for free tier)
- 10-15 minutes setup time

---

## 🚀 **Step 1: Create Google Cloud Project**

### 1.1 Go to Google Cloud Console
1. Visit: https://console.cloud.google.com
2. Sign in with your Google account
3. Accept terms of service if prompted

### 1.2 Create New Project
1. Click the project dropdown (top left, next to "Google Cloud")
2. Click **"New Project"**
3. Enter project name: `colorbook-engine` (or your preferred name)
4. Select billing account or create one
5. Click **"Create"**
6. Wait for project creation (1-2 minutes)

### 1.3 Note Your Project ID
- **Important**: Copy your **Project ID** (not project name)
- Format looks like: `colorbook-engine-123456`
- You'll need this exact ID later

---

## 💳 **Step 2: Set Up Billing**

### 2.1 Enable Billing
1. Go to **Billing** in the left sidebar
2. Link a billing account (required for API usage)
3. Add credit card details
4. **Note**: Google gives $300 free credits for new accounts

### 2.2 Set Up Budget Alerts (Recommended)
1. Go to **Billing** → **Budgets & alerts**
2. Click **"Create Budget"**
3. Set budget: `$10/month` (plenty for testing)
4. Set alerts at 50%, 90%, 100%

---

## 🔌 **Step 3: Enable Required APIs**

### 3.1 Enable Vertex AI API
1. Go to **APIs & Services** → **Library**
2. Search for: `Vertex AI API`
3. Click on **"Vertex AI API"**
4. Click **"Enable"**
5. Wait for activation (30 seconds)

### 3.2 Enable Additional APIs (Optional but Recommended)
1. **Cloud Resource Manager API** - for project management
2. **Service Usage API** - for API monitoring
3. Search and enable each one

---

## 🔑 **Step 4: Create Service Account & API Key**

### 4.1 Create Service Account
1. Go to **IAM & Admin** → **Service Accounts**
2. Click **"Create Service Account"**
3. Enter details:
   - **Name**: `colorbook-imagen-service`
   - **Description**: `Service account for ColorBook Engine image generation`
4. Click **"Create and Continue"**

### 4.2 Assign Roles
1. Add these roles:
   - **Vertex AI User** (required for Imagen)
   - **AI Platform Developer** (optional, for advanced features)
2. Click **"Continue"** → **"Done"**

### 4.3 Create API Key
1. Find your new service account in the list
2. Click the **email address** to open details
3. Go to **"Keys"** tab
4. Click **"Add Key"** → **"Create new key"**
5. Select **"JSON"** format
6. Click **"Create"**
7. **Important**: Save the downloaded JSON file securely

---

## 📱 **Step 5: Configure ColorBook Engine**

### 5.1 Get Your Credentials
From the downloaded JSON file, you need:
- **Project ID**: Look for `"project_id"` in the JSON
- **Private Key**: The entire JSON file content (or just the `private_key` field)

### 5.2 Add to ColorBook Engine
1. Open ColorBook Engine
2. Go to **Settings** (⚙️ icon)
3. Select image service: **"Google Imagen 2"**
4. Enter:
   - **Google Cloud Project ID**: Your project ID from JSON
   - **Service Account Key**: Either paste the entire JSON or just the private key

### 5.3 Test Connection
1. Click **"Test Google AI"** button
2. Should see: ✅ "Google AI connection successful!"
3. If error, check credentials and try again

---

## 🧪 **Step 6: Test Image Generation**

### 6.1 Generate Your First Image
1. Create a new project in ColorBook Engine
2. Go to **Story Generator**
3. Generate a story (or use existing)
4. Click **"Generate Image"** on any story page
5. Watch Google Imagen create a beautiful coloring page!

### 6.2 Verify Quality
- Images should be black and white line art
- Perfect for coloring books
- High quality and child-appropriate

---

## 💰 **Cost Information**

### Current Google Imagen Pricing (as of 2024)
- **Imagen 2**: ~$0.02-0.04 per image
- **Free Credits**: $300 for new Google Cloud accounts
- **Estimate**: 7,500+ images with free credits

### Cost Optimization Tips
1. **Start with Free Credits**: $300 should last months
2. **Set Budget Alerts**: Monitor spending
3. **Use Wisely**: Generate images only when needed
4. **Compare Providers**: Test different services for best value

---

## 🔧 **Troubleshooting**

### Common Issues & Solutions

#### ❌ "API not enabled" Error
**Solution**: 
1. Go to APIs & Services → Library
2. Search "Vertex AI API"
3. Make sure it's enabled

#### ❌ "Permission denied" Error
**Solution**:
1. Check service account has "Vertex AI User" role
2. Verify project ID is correct
3. Regenerate and download new JSON key

#### ❌ "Billing account required" Error
**Solution**:
1. Set up billing account in Google Cloud
2. Link credit card (required even for free tier)
3. Enable billing for your project

#### ❌ "Quota exceeded" Error
**Solution**:
1. Check billing account is active
2. Request quota increase in Google Cloud Console
3. Verify you're using correct region (us-central1)

#### ❌ Connection test fails
**Solution**:
1. Double-check project ID (not project name)
2. Verify JSON key is complete and valid
3. Try regenerating service account key
4. Check internet connection and firewall

---

## 🛡️ **Security Best Practices**

### Protect Your API Keys
1. **Never share** your JSON service account file
2. **Don't commit** keys to version control
3. **Store securely** in password manager
4. **Rotate keys** periodically (every 6 months)

### Monitor Usage
1. Set up **budget alerts**
2. Review **billing reports** monthly
3. Check **API usage** in Google Cloud Console
4. **Disable APIs** if not using

---

## 📞 **Getting Help**

### Google Cloud Support
- **Documentation**: https://cloud.google.com/vertex-ai/docs
- **Support**: Available in Google Cloud Console
- **Community**: Stack Overflow with `google-cloud-platform` tag

### ColorBook Engine Support
- **Settings Help**: Built-in tooltips and validation
- **Test Connection**: Use the test button to verify setup
- **Error Messages**: Detailed error information provided

---

## 🎉 **You're All Set!**

Once completed, you'll have:
✅ Google Cloud project with billing enabled
✅ Vertex AI API activated
✅ Service account with proper permissions
✅ API keys configured in ColorBook Engine
✅ Google Imagen 2 generating amazing coloring pages!

### 🚀 **Next Steps**
1. **Generate your first AI story**
2. **Create beautiful coloring page images**
3. **Export professional PDFs**
4. **Publish to Amazon KDP**

**Welcome to the future of coloring book creation with Google AI!** 🎨✨

---

## 📋 **Quick Reference**

### Essential URLs
- **Google Cloud Console**: https://console.cloud.google.com
- **Vertex AI**: https://console.cloud.google.com/vertex-ai
- **Billing**: https://console.cloud.google.com/billing
- **APIs & Services**: https://console.cloud.google.com/apis

### Required Permissions
- Vertex AI User
- Service Account User (automatically granted)

### Cost Estimate
- **Testing**: $1-5/month (50-200 images)
- **Production**: $10-50/month (500-2000 images)
- **Free Credits**: $300 (lasts 6+ months for typical usage)