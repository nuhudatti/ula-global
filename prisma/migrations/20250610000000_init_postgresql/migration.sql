-- CreateTable
CREATE TABLE "Faculty" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL DEFAULT 'ibbul',
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "tagline" TEXT,
    "logoUrl" TEXT,
    "logoPublicId" TEXT,
    "bannerUrl" TEXT,
    "bannerPublicId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Faculty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FacultyAdminInvite" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "facultyId" TEXT NOT NULL,
    "invitedById" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "otpHash" TEXT,
    "otpExpiresAt" TIMESTAMP(3),
    "otpUsedAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FacultyAdminInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "facultyId" TEXT NOT NULL,
    "tagline" TEXT,
    "logoUrl" TEXT,
    "logoPublicId" TEXT,
    "bannerUrl" TEXT,
    "bannerPublicId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Institution" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL DEFAULT 'ibbul',
    "name" TEXT NOT NULL,
    "shortName" TEXT NOT NULL,
    "tagline" TEXT,
    "logoUrl" TEXT,
    "logoPublicId" TEXT,
    "bannerUrl" TEXT,
    "bannerPublicId" TEXT,
    "logoPlacement" TEXT NOT NULL DEFAULT 'left',
    "primaryColor" TEXT NOT NULL DEFAULT '#14532d',
    "secondaryColor" TEXT NOT NULL DEFAULT '#166534',
    "contactEmail" TEXT,
    "website" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Institution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformOperator" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'PLATFORM_SUPER_ADMIN',
    "accountStatus" TEXT NOT NULL DEFAULT 'ACTIVE',
    "lastActiveAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformOperator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformPasswordResetToken" (
    "id" TEXT NOT NULL,
    "operatorId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformPasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformEmailSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "smtpHost" TEXT,
    "smtpPort" INTEGER NOT NULL DEFAULT 587,
    "smtpSecure" BOOLEAN NOT NULL DEFAULT false,
    "smtpUser" TEXT,
    "smtpPass" TEXT,
    "smtpFrom" TEXT,
    "smtpFromName" TEXT DEFAULT 'ULA Platform',
    "smtpReplyTo" TEXT,
    "appPublicUrl" TEXT,
    "retryMax" INTEGER NOT NULL DEFAULT 3,
    "retryDelayMs" INTEGER NOT NULL DEFAULT 1000,
    "devOutbox" BOOLEAN NOT NULL DEFAULT true,
    "mirrorOutbox" BOOLEAN NOT NULL DEFAULT true,
    "templatesJson" TEXT,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformEmailSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Course" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "level" INTEGER,
    "semester" TEXT,
    "departmentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseDiscussion" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "parentId" TEXT,
    "topic" TEXT NOT NULL DEFAULT 'GENERAL',
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseDiscussion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SuggestPermission" (
    "id" TEXT NOT NULL,
    "lecturerId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SuggestPermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialSuggestion" (
    "id" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "lecturerId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'OTHER',
    "examYear" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "rejectReason" TEXT,
    "fileUrl" TEXT NOT NULL,
    "cloudinaryPublicId" TEXT,
    "originalFileName" TEXT NOT NULL,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "reviewedAt" TIMESTAMP(3),
    "publishedResourceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaterialSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL DEFAULT 'ibbul',
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "matricNumber" TEXT,
    "role" TEXT NOT NULL DEFAULT 'STUDENT',
    "departmentId" TEXT,
    "facultyId" TEXT,
    "staffId" TEXT,
    "accountStatus" TEXT NOT NULL DEFAULT 'ACTIVE',
    "departmentRole" TEXT,
    "canUpload" BOOLEAN NOT NULL DEFAULT true,
    "bio" TEXT,
    "profilePhotoUrl" TEXT,
    "profilePhotoPublicId" TEXT,
    "bannerUrl" TEXT,
    "bannerPublicId" TEXT,
    "lastActiveAt" TIMESTAMP(3),
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
    "passwordChangedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Assignment" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "lecturerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "instructions" TEXT,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "allowedTypes" TEXT NOT NULL DEFAULT 'pdf,docx,pptx,zip,png,jpg',
    "attachmentUrl" TEXT,
    "attachmentName" TEXT,
    "attachmentStoredName" TEXT,
    "attachmentCloudinaryPublicId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Assignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssignmentSubmission" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "storedName" TEXT,
    "cloudinaryPublicId" TEXT,
    "originalFileName" TEXT NOT NULL,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssignmentSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LecturerCourseAssignment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "semester" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LecturerCourseAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LecturerInvite" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT,
    "email" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "staffId" TEXT,
    "departmentRole" TEXT NOT NULL DEFAULT 'LECTURER',
    "departmentId" TEXT,
    "invitedById" TEXT,
    "token" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "canUpload" BOOLEAN NOT NULL DEFAULT true,
    "courseIdsJson" TEXT,
    "resentCount" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LecturerInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DepartmentNotice" (
    "id" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DepartmentNotice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Resource" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "kind" TEXT NOT NULL DEFAULT 'OTHER',
    "examYear" INTEGER,
    "governanceStatus" TEXT NOT NULL DEFAULT 'VERIFIED',
    "sourceType" TEXT NOT NULL DEFAULT 'LECTURER',
    "semester" TEXT,
    "fileUrl" TEXT NOT NULL,
    "cloudinaryPublicId" TEXT,
    "originalFileName" TEXT NOT NULL,
    "mimeType" TEXT,
    "sizeBytes" INTEGER,
    "downloadCount" INTEGER NOT NULL DEFAULT 0,
    "averageRating" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ratingCount" INTEGER NOT NULL DEFAULT 0,
    "courseId" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "contributedById" TEXT,
    "suggestionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Resource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResourceRating" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "stars" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResourceRating_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Backup" (
    "id" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "size" INTEGER,
    "version" TEXT NOT NULL DEFAULT '1',
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "trigger" TEXT NOT NULL DEFAULT 'manual',
    "engine" TEXT NOT NULL DEFAULT 'sqlite',
    "actorId" TEXT,
    "checksum" TEXT,
    "offsiteCopied" BOOLEAN NOT NULL DEFAULT false,
    "offsitePath" TEXT,
    "validatedAt" TIMESTAMP(3),
    "validationOk" BOOLEAN,
    "integrityChecked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Backup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemAuditLog" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actorId" TEXT,
    "actorType" TEXT NOT NULL DEFAULT 'user',
    "institutionId" TEXT,
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SystemAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Faculty_institutionId_idx" ON "Faculty"("institutionId");

-- CreateIndex
CREATE UNIQUE INDEX "Faculty_institutionId_code_key" ON "Faculty"("institutionId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "FacultyAdminInvite_token_key" ON "FacultyAdminInvite"("token");

-- CreateIndex
CREATE INDEX "FacultyAdminInvite_facultyId_idx" ON "FacultyAdminInvite"("facultyId");

-- CreateIndex
CREATE INDEX "FacultyAdminInvite_email_idx" ON "FacultyAdminInvite"("email");

-- CreateIndex
CREATE INDEX "FacultyAdminInvite_status_idx" ON "FacultyAdminInvite"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Department_facultyId_name_key" ON "Department"("facultyId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Institution_slug_key" ON "Institution"("slug");

-- CreateIndex
CREATE INDEX "Institution_status_idx" ON "Institution"("status");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformOperator_email_key" ON "PlatformOperator"("email");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformPasswordResetToken_tokenHash_key" ON "PlatformPasswordResetToken"("tokenHash");

-- CreateIndex
CREATE INDEX "PlatformPasswordResetToken_operatorId_idx" ON "PlatformPasswordResetToken"("operatorId");

-- CreateIndex
CREATE UNIQUE INDEX "Course_departmentId_code_key" ON "Course"("departmentId", "code");

-- CreateIndex
CREATE INDEX "CourseDiscussion_courseId_createdAt_idx" ON "CourseDiscussion"("courseId", "createdAt");

-- CreateIndex
CREATE INDEX "CourseDiscussion_parentId_idx" ON "CourseDiscussion"("parentId");

-- CreateIndex
CREATE INDEX "CourseDiscussion_authorId_idx" ON "CourseDiscussion"("authorId");

-- CreateIndex
CREATE INDEX "SuggestPermission_studentId_idx" ON "SuggestPermission"("studentId");

-- CreateIndex
CREATE INDEX "SuggestPermission_lecturerId_idx" ON "SuggestPermission"("lecturerId");

-- CreateIndex
CREATE INDEX "SuggestPermission_departmentId_idx" ON "SuggestPermission"("departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "SuggestPermission_lecturerId_studentId_key" ON "SuggestPermission"("lecturerId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "MaterialSuggestion_publishedResourceId_key" ON "MaterialSuggestion"("publishedResourceId");

-- CreateIndex
CREATE INDEX "MaterialSuggestion_lecturerId_status_idx" ON "MaterialSuggestion"("lecturerId", "status");

-- CreateIndex
CREATE INDEX "MaterialSuggestion_studentId_status_idx" ON "MaterialSuggestion"("studentId", "status");

-- CreateIndex
CREATE INDEX "MaterialSuggestion_permissionId_idx" ON "MaterialSuggestion"("permissionId");

-- CreateIndex
CREATE INDEX "User_institutionId_idx" ON "User"("institutionId");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE UNIQUE INDEX "User_institutionId_email_key" ON "User"("institutionId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "User_institutionId_matricNumber_key" ON "User"("institutionId", "matricNumber");

-- CreateIndex
CREATE INDEX "Assignment_courseId_dueAt_idx" ON "Assignment"("courseId", "dueAt");

-- CreateIndex
CREATE INDEX "Assignment_lecturerId_createdAt_idx" ON "Assignment"("lecturerId", "createdAt");

-- CreateIndex
CREATE INDEX "Assignment_status_idx" ON "Assignment"("status");

-- CreateIndex
CREATE INDEX "AssignmentSubmission_assignmentId_submittedAt_idx" ON "AssignmentSubmission"("assignmentId", "submittedAt");

-- CreateIndex
CREATE INDEX "AssignmentSubmission_studentId_idx" ON "AssignmentSubmission"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "AssignmentSubmission_assignmentId_studentId_key" ON "AssignmentSubmission"("assignmentId", "studentId");

-- CreateIndex
CREATE INDEX "LecturerCourseAssignment_courseId_idx" ON "LecturerCourseAssignment"("courseId");

-- CreateIndex
CREATE UNIQUE INDEX "LecturerCourseAssignment_userId_courseId_key" ON "LecturerCourseAssignment"("userId", "courseId");

-- CreateIndex
CREATE UNIQUE INDEX "LecturerInvite_token_key" ON "LecturerInvite"("token");

-- CreateIndex
CREATE INDEX "LecturerInvite_departmentId_idx" ON "LecturerInvite"("departmentId");

-- CreateIndex
CREATE INDEX "LecturerInvite_institutionId_idx" ON "LecturerInvite"("institutionId");

-- CreateIndex
CREATE INDEX "LecturerInvite_email_idx" ON "LecturerInvite"("email");

-- CreateIndex
CREATE INDEX "LecturerInvite_status_idx" ON "LecturerInvite"("status");

-- CreateIndex
CREATE INDEX "LecturerInvite_departmentRole_idx" ON "LecturerInvite"("departmentRole");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");

-- CreateIndex
CREATE INDEX "DepartmentNotice_departmentId_idx" ON "DepartmentNotice"("departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "Resource_suggestionId_key" ON "Resource"("suggestionId");

-- CreateIndex
CREATE INDEX "Resource_courseId_idx" ON "Resource"("courseId");

-- CreateIndex
CREATE INDEX "Resource_contributedById_idx" ON "Resource"("contributedById");

-- CreateIndex
CREATE INDEX "Resource_createdAt_idx" ON "Resource"("createdAt");

-- CreateIndex
CREATE INDEX "Resource_examYear_idx" ON "Resource"("examYear");

-- CreateIndex
CREATE INDEX "Resource_governanceStatus_idx" ON "Resource"("governanceStatus");

-- CreateIndex
CREATE INDEX "ResourceRating_resourceId_idx" ON "ResourceRating"("resourceId");

-- CreateIndex
CREATE INDEX "ResourceRating_userId_idx" ON "ResourceRating"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ResourceRating_userId_resourceId_key" ON "ResourceRating"("userId", "resourceId");

-- CreateIndex
CREATE INDEX "Backup_createdAt_idx" ON "Backup"("createdAt");

-- CreateIndex
CREATE INDEX "Backup_status_idx" ON "Backup"("status");

-- CreateIndex
CREATE INDEX "SystemAuditLog_action_idx" ON "SystemAuditLog"("action");

-- CreateIndex
CREATE INDEX "SystemAuditLog_createdAt_idx" ON "SystemAuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "SystemAuditLog_institutionId_idx" ON "SystemAuditLog"("institutionId");

-- AddForeignKey
ALTER TABLE "Faculty" ADD CONSTRAINT "Faculty_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FacultyAdminInvite" ADD CONSTRAINT "FacultyAdminInvite_facultyId_fkey" FOREIGN KEY ("facultyId") REFERENCES "Faculty"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FacultyAdminInvite" ADD CONSTRAINT "FacultyAdminInvite_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_facultyId_fkey" FOREIGN KEY ("facultyId") REFERENCES "Faculty"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformPasswordResetToken" ADD CONSTRAINT "PlatformPasswordResetToken_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "PlatformOperator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Course" ADD CONSTRAINT "Course_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseDiscussion" ADD CONSTRAINT "CourseDiscussion_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseDiscussion" ADD CONSTRAINT "CourseDiscussion_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseDiscussion" ADD CONSTRAINT "CourseDiscussion_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "CourseDiscussion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuggestPermission" ADD CONSTRAINT "SuggestPermission_lecturerId_fkey" FOREIGN KEY ("lecturerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuggestPermission" ADD CONSTRAINT "SuggestPermission_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialSuggestion" ADD CONSTRAINT "MaterialSuggestion_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "SuggestPermission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialSuggestion" ADD CONSTRAINT "MaterialSuggestion_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialSuggestion" ADD CONSTRAINT "MaterialSuggestion_lecturerId_fkey" FOREIGN KEY ("lecturerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialSuggestion" ADD CONSTRAINT "MaterialSuggestion_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialSuggestion" ADD CONSTRAINT "MaterialSuggestion_publishedResourceId_fkey" FOREIGN KEY ("publishedResourceId") REFERENCES "Resource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_facultyId_fkey" FOREIGN KEY ("facultyId") REFERENCES "Faculty"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_lecturerId_fkey" FOREIGN KEY ("lecturerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentSubmission" ADD CONSTRAINT "AssignmentSubmission_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentSubmission" ADD CONSTRAINT "AssignmentSubmission_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LecturerCourseAssignment" ADD CONSTRAINT "LecturerCourseAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LecturerCourseAssignment" ADD CONSTRAINT "LecturerCourseAssignment_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LecturerInvite" ADD CONSTRAINT "LecturerInvite_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LecturerInvite" ADD CONSTRAINT "LecturerInvite_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LecturerInvite" ADD CONSTRAINT "LecturerInvite_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepartmentNotice" ADD CONSTRAINT "DepartmentNotice_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DepartmentNotice" ADD CONSTRAINT "DepartmentNotice_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Resource" ADD CONSTRAINT "Resource_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Resource" ADD CONSTRAINT "Resource_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Resource" ADD CONSTRAINT "Resource_contributedById_fkey" FOREIGN KEY ("contributedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceRating" ADD CONSTRAINT "ResourceRating_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceRating" ADD CONSTRAINT "ResourceRating_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

