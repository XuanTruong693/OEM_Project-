import React, { createContext, useContext, useState, useEffect } from 'react';

// Translations
const translations = {
    vi: {
        // Common
        save: 'Lưu',
        cancel: 'Hủy',
        delete: 'Xóa',
        edit: 'Chỉnh sửa',
        view: 'Xem',
        search: 'Tìm kiếm',
        loading: 'Đang tải...',
        noData: 'Không có dữ liệu',
        confirm: 'Xác nhận',
        success: 'Thành công',
        error: 'Lỗi',

        // Shared Admin Keys (Used in Sidebar, Results, Exam Overview, etc.)
        totalResults: 'Tổng số kết quả',
        avgScore: 'Điểm trung bình',
        score: 'Điểm',
        aiScore: 'Điểm AI',
        submittedAt: 'Nộp lúc',
        action: 'Hành động',
        editScore: 'Chỉnh sửa điểm số',
        mcqScore: 'Điểm trắc nghiệm',
        essayScore: 'Điểm tự luận',
        totalScore: 'Tổng điểm',
        note: 'Ghi chú',
        scoreUpdateNote: 'Điểm tổng sẽ được cập nhật dựa trên tổng điểm trắc nghiệm và điểm tự luận.',
        allExams: 'Tất cả bài thi',
        notUpdated: 'Chưa cập nhật',
        questionList: 'Danh sách câu hỏi',

        // Sidebar
        dashboard: 'Dashboard',
        userManagement: 'Quản lý người dùng',
        studentCards: 'Thẻ Sinh Viên', // ✅ [StudentCard]
        examManagement: 'Quản lý bài thi',
        examOverview: 'Tổng quan bài thi',
        results: 'Kết quả',
        resultsManagementTitle: 'Quản lý kết quả',
        resultsManagementDesc: 'Xem và điều chỉnh điểm số của sinh viên.',
        systemLogs: 'System Logs',
        settings: 'Cài đặt',
        adminPanel: 'Admin Panel',
        logout: 'Đăng xuất',

        // Dashboard
        totalStudents: 'Tổng số sinh viên',
        totalInstructors: 'Tổng số giảng viên',
        totalExams: 'Tổng bài thi đã tải lên',
        totalRooms: 'Tổng số phòng thi',
        publishedRooms: 'Phòng thi đã công bố',
        upcomingExams: 'Bài thi sắp diễn ra',
        viewAllExams: 'Xem tất cả bài thi',
        userGrowth: 'Thống kê tăng trưởng người dùng',
        last12Months: '12 tháng gần đây',
        performance: 'Hiệu suất',
        sinceLastMonth: 'so với tháng trước',

        // User Management
        editUser: 'Chỉnh sửa người dùng',
        userDetails: 'Chi tiết người dùng',
        confirmDelete: 'Xác nhận xóa',
        deleteConfirmText: 'Bạn có chắc chắn muốn xóa?',
        cannotUndo: 'Hành động này không thể hoàn tác.',
        fullName: 'Họ và tên',
        email: 'Email',
        role: 'Vai trò',
        gender: 'Giới tính',
        phone: 'Số điện thoại',
        address: 'Địa chỉ',
        createdAt: 'Ngày tạo',
        allRoles: 'Tất cả vai trò',
        searchByNameOrEmail: 'Tìm kiếm theo tên hoặc email...',
        showing: 'Hiển thị',
        of: 'trong tổng số',
        users: 'người dùng',
        page: 'Trang',
        saveChanges: 'Lưu thay đổi',
        saving: 'Đang lưu...',
        deleting: 'Đang xóa...',
        cannotChangeAdminRole: 'Không thể thay đổi role của Admin',
        cannotDeleteAdmin: 'Không thể xóa Admin',
        male: 'Nam',
        female: 'Nữ',
        other: 'Khác',
        notSelected: 'Chưa chọn',

        // Exam Management
        instructor: 'Giảng viên',
        status: 'Trạng thái',
        timeOpen: 'Thời gian mở',
        timeClose: 'Thời gian đóng',
        duration: 'Thời lượng',
        minutes: 'phút',
        questions: 'câu hỏi',
        candidates: 'Thí sinh',
        allStatus: 'Tất cả trạng thái',
        searchExam: 'Tìm kiếm bài thi...',
        ongoing: 'Đang diễn ra',
        upcoming: 'Sắp diễn ra',
        ended: 'Đã kết thúc',
        draft: 'Bản nháp',
        updateEndTime: 'Cập nhật thời gian kết thúc',
        newEndTime: 'Thời gian kết thúc mới',
        endTimeNote: '* Thời gian kết thúc phải sau thời điểm hiện tại',
        cannotDeleteOngoing: 'Không thể xóa bài thi đang diễn ra',
        examDetails: 'Chi tiết bài thi',

        // Results
        student: 'Sinh viên',
        exam: 'Bài thi',
        confirmed: 'Đã xác nhận',
        pending: 'Chờ chấm',
        currentScore: 'Điểm hiện tại',
        newScore: 'Điểm mới',
        exams: 'bài thi',
        resultsText: 'kết quả',

        // System Logs
        activityLogs: 'Activity Logs',
        suspiciousActivities: 'Suspicious Activities',
        time: 'Thời gian',
        admin: 'Admin',
        table: 'Bảng',
        description: 'Mô tả',
        ip: 'IP',
        allActions: 'Tất cả hành động',
        searchLogs: 'Tìm kiếm theo email hoặc mô tả...',
        refresh: 'Làm mới',
        login: 'Đăng nhập',
        create: 'Tạo mới',
        update: 'Cập nhật',
        backup: 'Backup',
        restore: 'Restore',
        noSuspicious: 'Không có hoạt động đáng ngờ nào!',
        systemSafe: 'Hệ thống đang hoạt động an toàn',
        markReviewed: 'Đánh dấu đã xem',
        reviewed: 'Đã xem xét',
        logs: 'logs',

        // Settings
        settingsTitle: 'Cài đặt',
        settingsDesc: 'Cấu hình hệ thống và tùy chọn cá nhân',
        appearance: 'Giao diện',
        theme: 'Theme',
        darkMode: 'Dark Mode',
        lightMode: 'Light Mode',
        language: 'Ngôn ngữ',
        vietnamese: 'Tiếng Việt',
        english: 'English',
        growthTarget: 'Mục tiêu tăng trưởng',
        yearlyUserTarget: 'Mục tiêu người dùng mới trong năm',
        yearlyUserTargetDesc: 'Số lượng tài khoản mới mong muốn đạt được trong năm nay',
        backupConfig: 'Cấu hình Backup',
        autoBackup: 'Backup tự động',
        backupTime: 'Thời gian backup',
        retentionDays: 'Giữ backup (ngày)',
        createBackupNow: 'Tạo Backup Ngay',
        creatingBackup: 'Đang backup...',
        suspiciousThresholds: 'Ngưỡng phát hiện bất thường',
        massDelete: 'Xóa hàng loạt (số lần/phút)',
        failedLogin: 'Login thất bại (số lần/10 phút)',
        restoreFrequency: 'Restore liên tục (số lần/ngày)',
        recentBackups: 'Lịch sử Backup gần đây',
        noBackups: 'Chưa có backup nào',
        backupType: 'Loại',
        fileName: 'File',
        fileSize: 'Kích thước',
        performedBy: 'Thực hiện bởi',
        manual: 'Thủ công',
        scheduled: 'Tự động',
        completed: 'Hoàn thành',
        failed: 'Thất bại',
        saveSettings: 'Lưu cài đặt',
        savingSettings: 'Đang lưu...',
        updateSuccess: 'Cập nhật thành công!',
        backupSuccess: 'Backup thành công!',

        // Exam Overview
        examOverviewTitle: 'Tổng quan bài thi',
        examOverviewDesc: 'Xem tổng quan các bài thi và câu hỏi',
        totalExamsCount: 'Tổng bài thi',
        ongoingCount: 'Đang diễn ra',
        upcomingCount: 'Sắp diễn ra',
        totalQuestionsCount: 'Tổng câu hỏi',
        viewDetails: 'Xem chi tiết',
        noQuestionsFound: 'Không có câu hỏi nào',
        loadingQuestions: 'Đang tải câu hỏi...',
        points: 'điểm',

        // AI Grading Monitor
        aiGradingMonitorTitle: 'Giám sát Chấm điểm AI',
        aiGradingMonitorDesc: 'Theo dõi trạng thái và tiến độ của hệ thống chấm điểm tự luận bằng AI',
        totalSubmissions: 'Tổng Bài Nộp',
        pendingStatus: 'Chờ Xử Lý',
        missedStatus: 'Bị Bỏ Sót',
        failedStatus: 'Bị Lỗi',
        completedStatus: 'Đã Hoàn Thành',
        searchPlaceholderAI: 'Tìm kiếm mã bài, email hoặc tên SV...',
        regradeMissed: 'Chấm lại bài sót',
        id: 'Mã Bài',
        studentName: 'Sinh viên',
        examTitle: 'Đợt thi',
        submittedDateTime: 'Ngày nộp',
        aiScoreLabel: 'Điểm AI',
        viewDetailsAction: 'Xem chi tiết',
        loadingAnalysis: 'Đang tải biểu mẫu phân tích...',
        dataLoadingError: 'Lỗi Tải Dữ Liệu',
        dataLoadingErrorDesc: 'Không thể lấy thông tin chi tiết hoặc bài nộp này không tồn tại.',
        aiGradingLog: 'Log Chấm Điểm AI',
        examProfile: 'Hồ sơ bài thi',
        candidate: 'Thí sinh',
        modelStatus: 'Trạng thái Model',
        errorStack: 'Stack/Trace Lỗi:',
        aiEssayScore: 'Điểm Tự Luận AI',
        suggestedTotalScore: 'T.Điểm (Tạm Tính)',
        triggerRegrade: 'Trigger Chấm Lại',
        triggerRegradeDesc: 'Bấm để đưa bài này vào Queue của AI Classifier.',
        tracingModelOutput: 'Tracing Model Output',
        noEssayFound: 'Bài thi không có tự luận',
        aiServiceNote: 'AI Service chỉ khả dụng với các câu hỏi loại Tự luận (Essay).',
        scoreLabel: 'Điểm:',
        emptySkipped: 'Trống / Bỏ qua',
        rawInputStudent: 'Raw Input (Sinh viên)',
        groundTruthReference: 'Ground Truth (Mẫu)',
        modelInferenceLog: 'Model Inference Log',
        pipelineMode: 'Pipeline Mode',
        confidence: 'Confidence',
        reasoningChain: 'Reasoning (Chain of Thought):',
        modelProcessing: 'Model đang xử lý pipeline...',
        traceLogNotFound: 'Trace log not found. Error or skipped.',
        confirmRegrade: 'Xác nhận chấm lại',
        confirmRegradeDesc: 'Bạn có chắc muốn ép hệ thống chấm lại bài này? Mọi log cũ sẽ bị xóa và bài thi sẽ được ghép vào hàng đợi AI.',
        instructorModified: 'Giảng viên sửa điểm',
        instructorModifiedStatus: 'Giảng viên sửa điểm',
        instructorFeedback: 'Phản hồi của giảng viên',
        finalScore: 'Điểm cuối cùng',
        originalAIScore: 'Điểm AI ban đầu',

        // Batch Regrade
        aiBatchRegradeTool: 'Công cụ chấm lại bài thi AI',
        aiBatchRegradeDesc: 'Xem và lọc danh sách các bài thi trước khi chấm hàng loạt.',
        regradeMode: 'Chế độ chấm bài',
        missedOnly: 'Chỉ bài sót',
        noAIStatus: 'Chưa có trạng thái AI',
        failedOnly: 'Chỉ bài lỗi',
        failedStatusDesc: 'Đang ở trạng thái Failed',
        allSubmissions: 'Tất cả bài',
        resetAllDesc: 'Bao gồm cả bài đã chấm (Reset lại)',
        fromDate: 'Từ ngày/giờ',
        toDate: 'Đến ngày/giờ',
        limitSubmissions: 'Giới hạn số lượng (N bài)',
        previewMatching: 'Preview: Danh sách bài thi thỏa mãn',
        noMatchingSubmissions: 'Không tìm thấy bài thi nào thỏa mãn điều kiện.',
        startRegrading: 'Bắt đầu chấm bài',

        // Student Card Management
        studentCardManagementTitle: 'Quản lý Thẻ Sinh viên',
        studentCardManagementDesc: 'Xem và quản lý danh sách thẻ sinh viên, trạng thái ảnh và phê duyệt',
        manualUpload: 'Tải lên thủ công',
        uploadExcel: 'Tải file Excel',
        batchUpdatePhotos: 'Cập nhật ảnh hàng loạt',
        searchPlaceholderStudent: 'Tìm kiếm theo Tên, MSSV hoặc Email...',
        photoStatus: 'Trạng thái ảnh',
        all: 'Tất cả',
        hasPhoto: 'Đã có ảnh',
        noPhoto: 'Chưa có ảnh',
        active: 'Hoạt động',
        locked: 'Bị khóa',
        exportData: 'Xuất dữ liệu',
        updatedAt: 'Cập nhật lúc',
        approve: 'Duyệt',
        actions: 'Thao tác',
        captured: 'Đã chụp',
        processing: 'Đang xử lý...',
        total: 'Tổng số',

        // Update Photos Page
        backToStudentCardManagement: 'Quay lại Quản lý Thẻ SV',
        updateStudentPhotos: 'Cập nhật Ảnh thẻ Sinh viên',
        updateStudentPhotosDesc: 'Chụp và cập nhật ảnh thẻ cho các sinh viên chưa có ảnh trong hệ thống',
        batchUpdate: 'Cập nhật ảnh thẻ',
        updateResult: 'Kết quả cập nhật',
        hideResult: 'Ẩn kết quả',
        capturedPhotosTitle: 'Ảnh đã chụp',
        capturedPhotosHint: 'Nhấn "Cập nhật ảnh thẻ" ở góc trên phải để lưu vào hệ thống',
        studentsWithoutPhotos: 'Sinh viên chưa có ảnh thẻ',
        searchNameID: 'Tìm kiếm theo Tên hoặc MSSV...',
        capture: 'Chụp ảnh',
        retake: 'Chụp lại',
        cameraOverlayHint: 'Đặt ảnh thẻ vào khung hình rồi nhấn Chụp',
        noCameraAccess: 'Không thể truy cập camera. Vui lòng cấp quyền camera.',
        noPhotosToUpdate: 'Chưa có ảnh nào để cập nhật.',
        photoCapturedFor: 'Đã chụp ảnh cho',
        allStudentsHavePhotos: 'Tất cả sinh viên đều đã có ảnh thẻ! 🎉',

        // Results Management Added Keys
        searchStudentPlaceholder: 'Tìm tên hoặc email sinh viên...',
        reviewAndEditScore: 'Xem & Chỉnh sửa điểm',
        studentInfo: 'Thông tin sinh viên',
        gradingInputs: 'Nhập điểm thành phần',
        finalGrandTotal: 'TỔNG ĐIỂM CUỐI CÙNG',
        adminScoreNote: 'Admin có thể sửa trực tiếp cả điểm trắc nghiệm và tự luận. Điểm sau khi lưu sẽ được hệ thống đồng bộ và gửi thông báo tới sinh viên.',
        detailedSubmissionReview: 'Chi tiết bài làm & Đáp án',
        loadingDetailedQuestions: 'Đang tải chi tiết bài làm...',
        noSubmissionDetailFound: 'Không tìm thấy dữ liệu chi tiết bài thi.',
        correct: 'ĐÚNG',
        incorrect: 'SAI',
        studentAnswer: 'Bài làm của sinh viên',
        modelAnswer: 'Đáp án mẫu',
        saveAndConfirm: 'Lưu & Xác nhận',
        pass: 'ĐẠT',
        fail: 'KHÔNG ĐẠT',
    },
    en: {
        // Common
        save: 'Save',
        cancel: 'Cancel',
        delete: 'Delete',
        edit: 'Edit',
        view: 'View',
        search: 'Search',
        loading: 'Loading...',
        noData: 'No data',
        confirm: 'Confirm',
        success: 'Success',
        error: 'Error',

        // Shared Admin Keys (Used in Sidebar, Results, Exam Overview, etc.)
        totalResults: 'Total Results',
        avgScore: 'Average Score',
        score: 'Score',
        aiScore: 'AI Score',
        submittedAt: 'Submitted At',
        action: 'Action',
        editScore: 'Edit Score',
        mcqScore: 'MCQ Score',
        essayScore: 'Essay Score',
        totalScore: 'Total Score',
        note: 'Note',
        scoreUpdateNote: 'The total score will be updated based on the sum of MCQ and essay scores.',
        allExams: 'All Exams',
        notUpdated: 'Not updated',
        questionList: 'Question List',

        // Sidebar
        dashboard: 'Dashboard',
        userManagement: 'User Management',
        studentCards: 'Student Cards', // ✅ [StudentCard]
        examManagement: 'Exam Management',
        examOverview: 'Exam Overview',
        results: 'Results',
        resultsManagementTitle: 'Results Management',
        resultsManagementDesc: 'View and adjust student scores.',
        systemLogs: 'System Logs',
        settings: 'Settings',
        adminPanel: 'Admin Panel',
        logout: 'Logout',

        // Dashboard
        totalStudents: 'Total Students',
        totalInstructors: 'Total Instructors',
        totalExams: 'Total Exams Uploaded',
        totalRooms: 'Total Rooms',
        publishedRooms: 'Published Rooms',
        upcomingExams: 'Upcoming Exams',
        viewAllExams: 'View All Exams',
        userGrowth: 'User Growth Statistics',
        last12Months: 'Last 12 Months',
        performance: 'Performance',
        sinceLastMonth: 'since last month',

        // User Management
        editUser: 'Edit User',
        userDetails: 'User Details',
        confirmDelete: 'Confirm Delete',
        deleteConfirmText: 'Are you sure you want to delete?',
        cannotUndo: 'This action cannot be undone.',
        fullName: 'Full Name',
        email: 'Email',
        role: 'Role',
        gender: 'Gender',
        phone: 'Phone',
        address: 'Address',
        createdAt: 'Created At',
        allRoles: 'All Roles',
        searchByNameOrEmail: 'Search by name or email...',
        showing: 'Showing',
        of: 'of',
        users: 'users',
        page: 'Page',
        saveChanges: 'Save Changes',
        saving: 'Saving...',
        deleting: 'Deleting...',
        cannotChangeAdminRole: 'Cannot change Admin role',
        cannotDeleteAdmin: 'Cannot delete Admin',
        male: 'Male',
        female: 'Female',
        other: 'Other',
        notSelected: 'Not selected',

        // Exam Management
        instructor: 'Instructor',
        status: 'Status',
        timeOpen: 'Open Time',
        timeClose: 'Close Time',
        duration: 'Duration',
        minutes: 'minutes',
        questions: 'questions',
        candidates: 'Candidates',
        allStatus: 'All Status',
        searchExam: 'Search exam...',
        ongoing: 'Ongoing',
        upcoming: 'Upcoming',
        ended: 'Ended',
        draft: 'Draft',
        updateEndTime: 'Update End Time',
        newEndTime: 'New End Time',
        endTimeNote: '* End time must be after current time',
        cannotDeleteOngoing: 'Cannot delete ongoing exam',
        examDetails: 'Exam Details',

        // Results
        student: 'Student',
        exam: 'Exam',
        confirmed: 'Confirmed',
        pending: 'Pending',
        currentScore: 'Current Score',
        newScore: 'New Score',
        exams: 'exams',
        resultsText: 'results',

        // System Logs
        activityLogs: 'Activity Logs',
        suspiciousActivities: 'Suspicious Activities',
        time: 'Time',
        admin: 'Admin',
        table: 'Table',
        description: 'Description',
        ip: 'IP',
        allActions: 'All Actions',
        searchLogs: 'Search by email or description...',
        refresh: 'Refresh',
        login: 'Login',
        create: 'Create',
        update: 'Update',
        backup: 'Backup',
        restore: 'Restore',
        noSuspicious: 'No suspicious activities!',
        systemSafe: 'System is running safely',
        markReviewed: 'Mark as reviewed',
        reviewed: 'Reviewed',
        logs: 'logs',

        // Settings
        settingsTitle: 'Settings',
        settingsDesc: 'System configuration and personal preferences',
        appearance: 'Appearance',
        theme: 'Theme',
        darkMode: 'Dark Mode',
        lightMode: 'Light Mode',
        language: 'Language',
        vietnamese: 'Vietnamese',
        english: 'English',
        growthTarget: 'Growth Target',
        yearlyUserTarget: 'Yearly user target',
        yearlyUserTargetDesc: 'Number of new accounts to achieve this year',
        backupConfig: 'Backup Configuration',
        autoBackup: 'Auto Backup',
        backupTime: 'Backup Time',
        retentionDays: 'Retention (days)',
        createBackupNow: 'Create Backup Now',
        creatingBackup: 'Creating backup...',
        suspiciousThresholds: 'Suspicious Detection Thresholds',
        massDelete: 'Mass delete (times/minute)',
        failedLogin: 'Failed login (times/10 minutes)',
        restoreFrequency: 'Restore frequency (times/day)',
        recentBackups: 'Recent Backups',
        noBackups: 'No backups yet',
        backupType: 'Type',
        fileName: 'File',
        fileSize: 'Size',
        performedBy: 'Performed By',
        manual: 'Manual',
        scheduled: 'Scheduled',
        completed: 'Completed',
        failed: 'Failed',
        saveSettings: 'Save Settings',
        savingSettings: 'Saving...',
        updateSuccess: 'Updated successfully!',
        backupSuccess: 'Backup successful!',

        // Exam Overview
        examOverviewTitle: 'Exam Overview',
        examOverviewDesc: 'View exam overview and questions',
        totalExamsCount: 'Total Exams',
        ongoingCount: 'Ongoing',
        upcomingCount: 'Upcoming',
        totalQuestionsCount: 'Total Questions',
        viewDetails: 'View Details',
        noQuestionsFound: 'No questions found',
        loadingQuestions: 'Loading questions...',
        points: 'points',

        // AI Grading Monitor
        aiGradingMonitorTitle: 'AI Grading Monitor',
        aiGradingMonitorDesc: 'Monitor the status and progress of the AI essay grading system',
        totalSubmissions: 'Total Submissions',
        pendingStatus: 'Pending',
        missedStatus: 'Missed',
        failedStatus: 'Failed',
        completedStatus: 'Completed',
        searchPlaceholderAI: 'Search by ID, email or student name...',
        regradeMissed: 'Regrade Missed',
        id: 'ID',
        studentName: 'Student',
        examTitle: 'Exam',
        submittedDateTime: 'Submitted At',
        aiScoreLabel: 'AI Score',
        viewDetailsAction: 'View Details',
        loadingAnalysis: 'Loading analysis details...',
        dataLoadingError: 'Data Loading Error',
        dataLoadingErrorDesc: 'Could not retrieve details or submission does not exist.',
        aiGradingLog: 'AI Grading Log',
        examProfile: 'Exam Profile',
        candidate: 'Candidate',
        modelStatus: 'Model Status',
        errorStack: 'Error Stack/Trace:',
        aiEssayScore: 'AI Essay Score',
        suggestedTotalScore: 'Suggested Total Score',
        triggerRegrade: 'Trigger Regrade',
        triggerRegradeDesc: 'Click to add this submission to the AI Classifier queue.',
        tracingModelOutput: 'Tracing Model Output',
        noEssayFound: 'No essay questions found',
        aiServiceNote: 'AI Service is only available for Essay type questions.',
        scoreLabel: 'Score:',
        emptySkipped: 'Empty / Skipped',
        rawInputStudent: 'Raw Input (Student)',
        groundTruthReference: 'Reference Answer',
        modelInferenceLog: 'Model Inference Log',
        pipelineMode: 'Pipeline Mode',
        confidence: 'Confidence',
        reasoningChain: 'Reasoning (Chain of Thought):',
        modelProcessing: 'Model is processing pipeline...',
        traceLogNotFound: 'Trace log not found. Error or skipped.',
        confirmRegrade: 'Confirm Regrade',
        confirmRegradeDesc: 'Are you sure you want to force a regrade? All old logs will be deleted and the submission will be added to the AI queue.',
        instructorModified: 'Instructor corrected',
        instructorModifiedStatus: 'Instructor Adjusted',
        instructorFeedback: 'Instructor feedback',
        finalScore: 'Final score',
        originalAIScore: 'Original AI score',

        // Batch Regrade
        aiBatchRegradeTool: 'AI Batch Regrade Tool',
        aiBatchRegradeDesc: 'Preview and filter submissions before batch regrading.',
        regradeMode: 'Regrade Mode',
        missedOnly: 'Missed only',
        noAIStatus: 'No AI status yet',
        failedOnly: 'Failed only',
        failedStatusDesc: 'Currently in Failed status',
        allSubmissions: 'All submissions',
        resetAllDesc: 'Includes graded ones (Reset all)',
        fromDate: 'From Date/Time',
        toDate: 'To Date/Time',
        limitSubmissions: 'Limit (N submissions)',
        previewMatching: 'Preview: Matching Submissions',
        noMatchingSubmissions: 'No submissions found matching criteria.',
        startRegrading: 'Start Regrading',

        // Student Card Management
        studentCardManagementTitle: 'Student Card Management',
        studentCardManagementDesc: 'View and manage student cards, photo status, and approvals',
        manualUpload: 'Manual Upload',
        uploadExcel: 'Upload Excel',
        batchUpdatePhotos: 'Batch Update Photos',
        searchPlaceholderStudent: 'Search by Name, ID or Email...',
        photoStatus: 'Photo Status',
        all: 'All',
        hasPhoto: 'Has Photo',
        noPhoto: 'No Photo',
        active: 'Active',
        locked: 'Locked',
        exportData: 'Export Data',
        updatedAt: 'Updated At',
        approve: 'Approve',

        // Update Photos Page
        backToStudentCards: 'Back to Student Cards',
        updateStudentPhotos: 'Update Student Photos',
        updateStudentPhotosDesc: 'Capture and update photos for students missing photos',
        batchUpdate: 'Batch update photos',
        updateResult: 'Update Results',
        hideResult: 'Hide results',
        capturedPhotos: 'Captured Photos',
        saveToSystemNote: 'Click "Update photos" at top right to save to system',
        missingPhotosTitle: 'Students missing photos',
        searchNameID: 'Search by Name or ID...',
        capturePhotoAction: 'Capture Photo',
        retakeAction: 'Retake',
        allStudentsHavePhotos: 'All students have photos! 🎉',
        captureIDPhoto: 'Capture ID Photo',
        captureNote: 'Place the card in the frame and press Capture',
        captureAction: 'Capture',
        // Results Management Added Keys
        searchStudentPlaceholder: 'Search student name or email...',
        reviewAndEditScore: 'Review & Edit Score',
        studentInfo: 'Student Information',
        gradingInputs: 'Grading Inputs',
        finalGrandTotal: 'FINAL GRAND TOTAL',
        adminScoreNote: 'Admin can directly edit both MCQ and essay scores. Once saved, the system will sync and notify the student.',
        detailedSubmissionReview: 'Detailed Submission Review',
        loadingDetailedQuestions: 'Loading submission details...',
        noSubmissionDetailFound: 'No submission detail found.',
        correct: 'CORRECT',
        incorrect: 'INCORRECT',
        studentAnswer: 'Student Answer',
        modelAnswer: 'Model Answer',
        saveAndConfirm: 'Save & Confirm',
        pass: 'PASS',
        fail: 'FAIL',
    }
};

const LanguageContext = createContext();

export const useLanguage = () => {
    const context = useContext(LanguageContext);
    if (!context) {
        throw new Error('useLanguage must be used within a LanguageProvider');
    }
    return context;
};

export const LanguageProvider = ({ children }) => {
    const [language, setLanguage] = useState(() => {
        return localStorage.getItem('oem_preferred_lang') || localStorage.getItem('admin_language') || 'vi';
    });

    // Function to apply Google Translate cookie
    const applyGoogleTranslate = (langCode) => {
        const hostname = window.location.hostname;
        const pathname = window.location.pathname;
        
        // Disable Google Translate for Admin pages to ensure UI stability
        // Internal translations (t function) will still work based on language state
        const isAdminPage = pathname.startsWith('/admin') || pathname.startsWith('/admin-dashboard') || pathname.startsWith('/exam-settings');
        
        // AGGRESSIVE DOM PROTECTION: Prevent Google Translate from touching Admin nodes
        if (isAdminPage) {
            document.body.classList.add('notranslate');
            document.documentElement.setAttribute('translate', 'no');
        } else {
            document.body.classList.remove('notranslate');
            document.documentElement.removeAttribute('translate');
        }
        
        const cookieValue = isAdminPage ? '' : `/vi/${langCode}`;
        const expires = isAdminPage ? '; expires=Thu, 01 Jan 1970 00:00:00 GMT' : '';
        
        // Robust domain logic
        const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
        let primaryDomain = hostname;
        
        if (!isLocalhost) {
            const domainParts = hostname.split('.');
            if (domainParts.length >= 3) {
                // Handle .io.vn, .com.vn, etc.
                primaryDomain = domainParts.slice(-3).join('.');
            }
        }

        try {
            const options = `; path=/; SameSite=Lax${expires}`;
            
            if (isLocalhost) {
                // Localhost: Simplified cookie without domain attribute
                document.cookie = `googtrans=${cookieValue}${options}`;
            } else {
                // Production: Comprehensive cookie setting across domains
                const domains = [hostname, `.${hostname}`, `.${primaryDomain}`];
                domains.forEach(d => {
                    document.cookie = `googtrans=${cookieValue}; domain=${d}${options}`;
                });
                document.cookie = `googtrans=${cookieValue}${options}`;
            }
            
            // AGGRESSIVE PURGE: If on Admin page, also try to remove the cookie without domain again just in case
            if (isAdminPage) {
                document.cookie = `googtrans=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
                // Add class to html too
                document.documentElement.classList.add('notranslate');
                document.documentElement.setAttribute('translate', 'no');
            }
            
            // Sync persistence keys
            localStorage.setItem('oem_preferred_lang', langCode);
            localStorage.setItem('admin_language', langCode);
            
            if (!isAdminPage) {
                console.log(`🌐 [Translation] Syncing ${langCode} for ${hostname}`);
            } else {
                console.log(`🚫 [Translation] Google Translate disabled for Admin path`);
            }
        } catch (e) {
            console.error("❌ [Translation] Error syncing cookie:", e);
        }
    };

    // Auto-sync on mount and whenever language changes
    useEffect(() => {
        applyGoogleTranslate(language);
    }, [language]);

    const t = (key) => {
        return translations[language]?.[key] || translations['vi']?.[key] || key;
    };

    const changeLanguage = (lang, shouldReload = false) => {
        setLanguage(lang);
        if (shouldReload) {
            // Give cookie time to propagate before reload
            setTimeout(() => window.location.reload(), 150);
        }
    };

    return (
        <LanguageContext.Provider value={{ language, setLanguage: changeLanguage, t, applyGoogleTranslate }}>
            {children}
        </LanguageContext.Provider>
    );
};

export default LanguageContext;
