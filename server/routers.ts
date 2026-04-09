import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import {
  gasUsers, gasAttendance, gasDailyPoints, gasMonthlyPoints,
  gasReviewLog, gasPointsConfig, gasFilesIndex, gasReports, gasConfig,
} from "./gas-api";
import { storagePut } from "./storage";
import { nanoid } from "nanoid";

// ============================================================
// 輔助函式
// ============================================================
function randomSuffix() { return nanoid(8); }

// ============================================================
// App Router
// ============================================================
export const appRouter = router({
  system: systemRouter,

  // ---- Auth ----
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ---- 系統設定 ----
  config: router({
    get: publicProcedure.query(() => gasConfig.get()),
    update: protectedProcedure
      .input(z.object({
        companyName: z.string().optional(),
        contractStart: z.string().optional(),
        contractEnd: z.string().optional(),
        totalWorkers: z.number().optional(),
        totalMonths: z.number().optional(),
        holidays: z.array(z.string()).optional(),
        driveFolderId: z.string().optional(),
      }))
      .mutation(({ input }) => gasConfig.update(input)),
  }),

  // ---- 點數定義表 ----
  pointsConfig: router({
    list: publicProcedure.query(() => gasPointsConfig.list()),
    listByWorkerType: publicProcedure
      .input(z.object({ workerType: z.string() }))
      .query(({ input }) => gasPointsConfig.listByWorkerType(input.workerType)),
  }),

  // ---- 人員名冊 ----
  users: router({
    list: protectedProcedure.query(() => gasUsers.list()),
    get: protectedProcedure
      .input(z.object({ userId: z.string() }))
      .query(({ input }) => gasUsers.get(input.userId)),
    create: protectedProcedure
      .input(z.object({
        name: z.string(),
        email: z.string().email(),
        role: z.enum(['admin', 'deptMgr', 'billing', 'worker']),
        department: z.string(),
        area: z.string(),
        workerType: z.enum(['general', 'offshore', 'safety', 'environment']),
        onboardDate: z.string(),
        pastExpDays: z.number().default(0),
        isActive: z.boolean().default(true),
      }))
      .mutation(({ input }) => gasUsers.create(input)),
    update: protectedProcedure
      .input(z.object({
        userId: z.string(),
        data: z.object({
          name: z.string().optional(),
          email: z.string().email().optional(),
          role: z.enum(['admin', 'deptMgr', 'billing', 'worker']).optional(),
          department: z.string().optional(),
          area: z.string().optional(),
          workerType: z.enum(['general', 'offshore', 'safety', 'environment']).optional(),
          onboardDate: z.string().optional(),
          pastExpDays: z.number().optional(),
          isActive: z.boolean().optional(),
        }),
      }))
      .mutation(({ input }) => gasUsers.update(input.userId, input.data)),
    delete: protectedProcedure
      .input(z.object({ userId: z.string() }))
      .mutation(({ input }) => gasUsers.delete(input.userId)),
  }),

  // ---- 差勤紀錄 ----
  attendance: router({
    listByMonth: protectedProcedure
      .input(z.object({ yearMonth: z.string() }))
      .query(({ input }) => gasAttendance.listByMonth(input.yearMonth)),
    listByUser: protectedProcedure
      .input(z.object({ userId: z.string(), yearMonth: z.string() }))
      .query(({ input }) => gasAttendance.listByUser(input.userId, input.yearMonth)),
    upsert: protectedProcedure
      .input(z.object({
        userId: z.string(),
        date: z.string(),
        amStatus: z.string(),
        pmStatus: z.string(),
        workHours: z.number(),
        leaveHours: z.number(),
        source: z.enum(['auto', 'planned', 'actual']),
        isFinalized: z.boolean(),
        note: z.string().default(''),
        updatedAt: z.string(),
      }))
      .mutation(({ input }) => gasAttendance.upsert(input as Parameters<typeof gasAttendance.upsert>[0])),
    finalize: protectedProcedure
      .input(z.object({ userId: z.string(), yearMonth: z.string() }))
      .mutation(({ input }) => gasAttendance.finalize(input.userId, input.yearMonth)),
  }),

  // ---- 每日點數明細 ----
  dailyPoints: router({
    listByDate: protectedProcedure
      .input(z.object({ userId: z.string(), date: z.string() }))
      .query(({ input }) => gasDailyPoints.listByDate(input.userId, input.date)),
    listByMonth: protectedProcedure
      .input(z.object({ userId: z.string(), yearMonth: z.string() }))
      .query(({ input }) => gasDailyPoints.listByMonth(input.userId, input.yearMonth)),
    upsert: protectedProcedure
      .input(z.object({
        recordId: z.string(),
        userId: z.string(),
        date: z.string(),
        itemId: z.string(),
        quantity: z.number(),
        points: z.number(),
        fileIds: z.array(z.string()),
        status: z.enum(['draft', 'submitted', 'approved', 'rejected']),
        uploadedAt: z.string(),
        updatedAt: z.string(),
      }))
      .mutation(({ input }) => gasDailyPoints.upsert(input)),
    updateStatus: protectedProcedure
      .input(z.object({ recordId: z.string(), status: z.string() }))
      .mutation(({ input }) => gasDailyPoints.updateStatus(input.recordId, input.status)),
  }),

  // ---- 月度點數明細 ----
  monthlyPoints: router({
    listByMonth: protectedProcedure
      .input(z.object({ userId: z.string(), yearMonth: z.string() }))
      .query(({ input }) => gasMonthlyPoints.listByMonth(input.userId, input.yearMonth)),
    upsert: protectedProcedure
      .input(z.object({
        recordId: z.string(),
        userId: z.string(),
        yearMonth: z.string(),
        itemId: z.string(),
        quantity: z.number(),
        points: z.number(),
        fileIds: z.array(z.string()),
        perfLevel: z.enum(['優', '佳', '平', '']).default(''),
        status: z.enum(['draft', 'submitted', 'approved', 'rejected']),
        uploadedAt: z.string(),
        updatedAt: z.string(),
      }))
      .mutation(({ input }) => gasMonthlyPoints.upsert(input)),
    setPerfLevel: protectedProcedure
      .input(z.object({ recordId: z.string(), perfLevel: z.string() }))
      .mutation(({ input }) => gasMonthlyPoints.setPerfLevel(input.recordId, input.perfLevel)),
    updateStatus: protectedProcedure
      .input(z.object({ recordId: z.string(), status: z.string() }))
      .mutation(({ input }) => gasMonthlyPoints.updateStatus(input.recordId, input.status)),
  }),

  // ---- 審核紀錄 ----
  reviewLog: router({
    listByMonth: protectedProcedure
      .input(z.object({ yearMonth: z.string() }))
      .query(({ input }) => gasReviewLog.listByMonth(input.yearMonth)),
    listByUser: protectedProcedure
      .input(z.object({ userId: z.string(), yearMonth: z.string() }))
      .query(({ input }) => gasReviewLog.listByUser(input.userId, input.yearMonth)),
    append: protectedProcedure
      .input(z.object({
        userId: z.string(),
        yearMonth: z.string(),
        reviewerUserId: z.string(),
        action: z.enum(['初審通過', '退回修改', '廠商確認', '廠商退回', '解鎖']),
        timestamp: z.string(),
        note: z.string().default(''),
      }))
      .mutation(({ input }) => gasReviewLog.append(input)),
  }),

  // ---- 佐證檔案 ----
  files: router({
    listByRecord: protectedProcedure
      .input(z.object({ userId: z.string(), date: z.string(), itemId: z.string() }))
      .query(({ input }) => gasFilesIndex.listByRecord(input.userId, input.date, input.itemId)),
    upload: protectedProcedure
      .input(z.object({
        userId: z.string(),
        date: z.string(),
        itemId: z.string(),
        fileName: z.string(),
        mimeType: z.string(),
        fileBase64: z.string(),
      }))
      .mutation(async ({ input }) => {
        // 上傳至 S3 (Manus Storage)
        const buffer = Buffer.from(input.fileBase64, 'base64');
        const fileKey = `evidence/${input.userId}/${input.date}/${input.itemId}-${randomSuffix()}-${input.fileName}`;
        const { url } = await storagePut(fileKey, buffer, input.mimeType);

        // 寫入佐證檔案索引
        const entry = await gasFilesIndex.append({
          userId: input.userId,
          date: input.date,
          itemId: input.itemId,
          fileName: input.fileName,
          mimeType: input.mimeType,
          driveFileId: fileKey,
          uploadedAt: new Date().toISOString(),
        });

        return { ...entry, url };
      }),
    delete: protectedProcedure
      .input(z.object({ fileId: z.string() }))
      .mutation(({ input }) => gasFilesIndex.delete(input.fileId)),
  }),

  // ---- 報表 ----
  reports: router({
    summary: protectedProcedure
      .input(z.object({ yearMonth: z.string() }))
      .query(({ input }) => gasReports.summary(input.yearMonth)),
    leave: protectedProcedure
      .input(z.object({ yearMonth: z.string() }))
      .query(({ input }) => gasReports.leave(input.yearMonth)),
    fee: protectedProcedure
      .input(z.object({ yearMonth: z.string() }))
      .query(({ input }) => gasReports.fee(input.yearMonth)),
    attendance: protectedProcedure
      .input(z.object({ userId: z.string(), yearMonth: z.string() }))
      .query(({ input }) => gasReports.attendance(input.userId, input.yearMonth)),
    workMonthly: protectedProcedure
      .input(z.object({ userId: z.string(), yearMonth: z.string() }))
      .query(({ input }) => gasReports.workMonthly(input.userId, input.yearMonth)),
  }),
});

export type AppRouter = typeof appRouter;
