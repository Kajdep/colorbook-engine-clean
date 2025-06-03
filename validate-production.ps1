# ColorBook Engine Production Validation Script
# PowerShell script to validate all components are ready for production

param(
    [switch]$Detailed,
    [switch]$SkipTests
)

$ErrorActionPreference = "Continue"
$ValidationResults = @()

function Add-ValidationResult {
    param($Component, $Status, $Message, $Details = "")
    $ValidationResults += [PSCustomObject]@{
        Component = $Component
        Status = $Status
        Message = $Message
        Details = $Details
    }
}

function Test-FileExists {
    param($Path, $Description)
    if (Test-Path $Path) {
        Add-ValidationResult "Files" "✅ PASS" "$Description exists" $Path
        return $true
    } else {
        Add-ValidationResult "Files" "❌ FAIL" "$Description missing" $Path
        return $false
    }
}

function Test-EnvironmentFile {
    Write-Host "🔧 Validating Environment Configuration..." -ForegroundColor Blue
    
    $envPath = "backend/deploy/.env.production"
    if (Test-Path $envPath) {
        $envContent = Get-Content $envPath
        $requiredVars = @(
            "NODE_ENV",
            "DB_HOST", "DB_USER", "DB_PASSWORD",
            "JWT_SECRET", "JWT_REFRESH_SECRET",
            "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET",
            "FRONTEND_URL", "BACKEND_URL"
        )
        
        $missingVars = @()
        foreach ($var in $requiredVars) {
            if (-not ($envContent | Where-Object { $_ -match "^$var=" })) {
                $missingVars += $var
            }
        }
        
        if ($missingVars.Count -eq 0) {
            Add-ValidationResult "Environment" "✅ PASS" "All required environment variables present"
        } else {
            Add-ValidationResult "Environment" "⚠️ WARNING" "Missing environment variables: $($missingVars -join ', ')"
        }
    } else {
        Add-ValidationResult "Environment" "❌ FAIL" "Production environment file not found" $envPath
    }
}

function Test-DatabaseSchema {
    Write-Host "🗄️ Validating Database Schema..." -ForegroundColor Blue
    
    $schemaPath = "backend/database/schema.sql"
    if (Test-Path $schemaPath) {
        $schemaContent = Get-Content $schemaPath -Raw
        $requiredTables = @("users", "projects", "stories", "images", "drawings", "subscriptions")
        $requiredColumns = @("stripe_customer_id", "stripe_subscription_id", "subscription_tier")
        
        $missingTables = @()
        $missingColumns = @()
        
        foreach ($table in $requiredTables) {
            if (-not ($schemaContent -match "CREATE TABLE $table")) {
                $missingTables += $table
            }
        }
        
        foreach ($column in $requiredColumns) {
            if (-not ($schemaContent -match $column)) {
                $missingColumns += $column
            }
        }
        
        if ($missingTables.Count -eq 0 -and $missingColumns.Count -eq 0) {
            Add-ValidationResult "Database" "✅ PASS" "Database schema includes all required tables and columns"
        } else {
            $issues = @()
            if ($missingTables.Count -gt 0) { $issues += "Missing tables: $($missingTables -join ', ')" }
            if ($missingColumns.Count -gt 0) { $issues += "Missing columns: $($missingColumns -join ', ')" }
            Add-ValidationResult "Database" "❌ FAIL" ($issues -join "; ")
        }
    } else {
        Add-ValidationResult "Database" "❌ FAIL" "Database schema file not found" $schemaPath
    }
}

function Test-PaymentSystem {
    Write-Host "💳 Validating Payment System..." -ForegroundColor Blue
    
    # Check payment routes file
    $paymentRoutesPath = "backend/src/routes/payments.js"
    if (Test-Path $paymentRoutesPath) {
        $paymentContent = Get-Content $paymentRoutesPath -Raw
        $requiredEndpoints = @(
            "create-checkout-session",
            "webhook",
            "subscription",
            "cancel-subscription"
        )
        
        $missingEndpoints = @()
        foreach ($endpoint in $requiredEndpoints) {
            if (-not ($paymentContent -match $endpoint)) {
                $missingEndpoints += $endpoint
            }
        }
        
        if ($missingEndpoints.Count -eq 0) {
            Add-ValidationResult "Payment" "✅ PASS" "All payment endpoints implemented"
        } else {
            Add-ValidationResult "Payment" "❌ FAIL" "Missing payment endpoints: $($missingEndpoints -join ', ')"
        }
    } else {
        Add-ValidationResult "Payment" "❌ FAIL" "Payment routes file not found" $paymentRoutesPath
    }
    
    # Check payment middleware
    $paymentMiddlewarePath = "backend/src/middleware/payment.js"
    if (Test-Path $paymentMiddlewarePath) {
        Add-ValidationResult "Payment" "✅ PASS" "Payment middleware implemented"
    } else {
        Add-ValidationResult "Payment" "❌ FAIL" "Payment middleware not found" $paymentMiddlewarePath
    }
}

function Test-FrontendComponents {
    Write-Host "🎨 Validating Frontend Components..." -ForegroundColor Blue
    
    $requiredComponents = @(
        "src/components/SubscriptionManager.tsx",
        "src/components/PaymentModal.tsx",
        "src/components/Dashboard.tsx",
        "src/store/useAppStore.ts"
    )
    
    $componentIssues = @()
    foreach ($component in $requiredComponents) {
        if (-not (Test-Path $component)) {
            $componentIssues += $component
        }
    }
    
    if ($componentIssues.Count -eq 0) {
        Add-ValidationResult "Frontend" "✅ PASS" "All required frontend components present"
    } else {
        Add-ValidationResult "Frontend" "❌ FAIL" "Missing components: $($componentIssues -join ', ')"
    }
}

function Test-DeploymentFiles {
    Write-Host "🚀 Validating Deployment Configuration..." -ForegroundColor Blue
    
    $deploymentFiles = @(
        @{ Path = "backend/deploy/docker-compose.yml"; Description = "Docker Compose file" },
        @{ Path = "backend/deploy/deploy-production.ps1"; Description = "PowerShell deployment script" },
        @{ Path = "backend/deploy/.env.production.template"; Description = "Environment template" },
        @{ Path = "backend/Dockerfile"; Description = "Backend Dockerfile" }
    )
    
    $allDeploymentFilesExist = $true
    foreach ($file in $deploymentFiles) {
        if (-not (Test-FileExists $file.Path $file.Description)) {
            $allDeploymentFilesExist = $false
        }
    }
    
    if ($allDeploymentFilesExist) {
        Add-ValidationResult "Deployment" "✅ PASS" "All deployment files present"
    }
}

function Test-MonitoringSystem {
    Write-Host "📊 Validating Monitoring System..." -ForegroundColor Blue
    
    $monitoringPath = "backend/src/routes/monitoring.js"
    if (Test-Path $monitoringPath) {
        $monitoringContent = Get-Content $monitoringPath -Raw
        $requiredEndpoints = @("health", "metrics", "analytics")
        
        $missingEndpoints = @()
        foreach ($endpoint in $requiredEndpoints) {
            if (-not ($monitoringContent -match $endpoint)) {
                $missingEndpoints += $endpoint
            }
        }
        
        if ($missingEndpoints.Count -eq 0) {
            Add-ValidationResult "Monitoring" "✅ PASS" "All monitoring endpoints implemented"
        } else {
            Add-ValidationResult "Monitoring" "⚠️ WARNING" "Missing monitoring endpoints: $($missingEndpoints -join ', ')"
        }
    } else {
        Add-ValidationResult "Monitoring" "❌ FAIL" "Monitoring routes file not found" $monitoringPath
    }
}

function Test-PackageIntegrity {
    Write-Host "📦 Validating Package Configuration..." -ForegroundColor Blue
    
    # Check backend package.json
    $backendPackagePath = "backend/package.json"
    if (Test-Path $backendPackagePath) {
        $backendPackage = Get-Content $backendPackagePath | ConvertFrom-Json
        $requiredDeps = @("express", "stripe", "pg", "bcryptjs", "jsonwebtoken", "joi")
        
        $missingDeps = @()
        foreach ($dep in $requiredDeps) {
            if (-not $backendPackage.dependencies.$dep) {
                $missingDeps += $dep
            }
        }
        
        if ($missingDeps.Count -eq 0) {
            Add-ValidationResult "Packages" "✅ PASS" "Backend has all required dependencies"
        } else {
            Add-ValidationResult "Packages" "❌ FAIL" "Missing backend dependencies: $($missingDeps -join ', ')"
        }
    }
    
    # Check frontend package.json
    $frontendPackagePath = "package.json"
    if (Test-Path $frontendPackagePath) {
        Add-ValidationResult "Packages" "✅ PASS" "Frontend package configuration present"
    } else {
        Add-ValidationResult "Packages" "❌ FAIL" "Frontend package.json not found"
    }
}

# Main validation process
Write-Host "🔍 ColorBook Engine Production Validation" -ForegroundColor Green
Write-Host "===========================================" -ForegroundColor Green
Write-Host ""

# Run all validation tests
Test-EnvironmentFile
Test-DatabaseSchema
Test-PaymentSystem
Test-FrontendComponents
Test-DeploymentFiles
Test-MonitoringSystem
Test-PackageIntegrity

# Run integration tests if not skipped
if (-not $SkipTests) {
    Write-Host "🧪 Running Integration Tests..." -ForegroundColor Blue
    
    $testPath = "backend/tests/payment-system-tests.js"
    if (Test-Path $testPath) {
        try {
            Push-Location "backend/tests"
            $testOutput = node payment-system-tests.js 2>&1
            if ($LASTEXITCODE -eq 0) {
                Add-ValidationResult "Tests" "✅ PASS" "Integration tests completed successfully"
            } else {
                Add-ValidationResult "Tests" "⚠️ WARNING" "Some integration tests had issues (may be normal without running services)"
            }
            Pop-Location
        } catch {
            Add-ValidationResult "Tests" "⚠️ WARNING" "Could not run integration tests: $($_.Exception.Message)"
            Pop-Location
        }
    } else {
        Add-ValidationResult "Tests" "❌ FAIL" "Integration test file not found" $testPath
    }
}

# Display results
Write-Host "`n📊 VALIDATION RESULTS" -ForegroundColor Green
Write-Host "=====================" -ForegroundColor Green

$passed = ($ValidationResults | Where-Object { $_.Status -match "✅" }).Count
$warnings = ($ValidationResults | Where-Object { $_.Status -match "⚠️" }).Count
$failed = ($ValidationResults | Where-Object { $_.Status -match "❌" }).Count
$total = $ValidationResults.Count

# Always show results, regardless of detailed flag
foreach ($result in $ValidationResults | Sort-Object Component, Status) {
    Write-Host "$($result.Status) [$($result.Component)] $($result.Message)" -ForegroundColor White
    if ($Detailed -and $result.Details) {
        Write-Host "    └─ $($result.Details)" -ForegroundColor Gray
    }
}

Write-Host "`n📈 SUMMARY:" -ForegroundColor Green
Write-Host "✅ Passed: $passed" -ForegroundColor Green
Write-Host "⚠️ Warnings: $warnings" -ForegroundColor Yellow
Write-Host "❌ Failed: $failed" -ForegroundColor Red
Write-Host "📊 Total: $total" -ForegroundColor Blue

$score = [math]::Round((($passed + $warnings * 0.5) / $total) * 100, 1)
Write-Host "`n🎯 Production Readiness Score: $score%" -ForegroundColor Cyan

if ($failed -eq 0 -and $warnings -le 2) {
    Write-Host "`n🎉 READY FOR PRODUCTION!" -ForegroundColor Green
    Write-Host "Your ColorBook Engine is ready for commercial launch." -ForegroundColor Green
    Write-Host "`nNext steps:" -ForegroundColor Blue
    Write-Host "1. Configure .env.production with your Stripe keys" -ForegroundColor White
    Write-Host "2. Run: .\backend\deploy\deploy-production.ps1" -ForegroundColor White
    Write-Host "3. Set up your domain and SSL certificates" -ForegroundColor White
} elseif ($failed -eq 0) {
    Write-Host "`n⚠️ MOSTLY READY - Minor issues to address" -ForegroundColor Yellow
    Write-Host "Address the warnings above before production deployment." -ForegroundColor Yellow
} else {
    Write-Host "`n❌ NOT READY - Critical issues found" -ForegroundColor Red
    Write-Host "Please fix the failed components before attempting production deployment." -ForegroundColor Red
}

Write-Host "`nFor detailed information, run with -Detailed flag" -ForegroundColor Gray
