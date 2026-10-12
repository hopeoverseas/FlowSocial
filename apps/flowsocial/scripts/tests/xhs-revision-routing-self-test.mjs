import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.FLOWSOCIAL_DISABLE_SERVER_LISTEN = "1";
const isolatedDataDir = await mkdtemp(join(tmpdir(), "flowsocial-xhs-routing-"));
process.env.FLOWSOCIAL_DATA_DIR = isolatedDataDir;
const { classifyRevision, server } = await import("../../server.mjs");

const route = (instruction, platform = "xiaohongshu") => classifyRevision(instruction, platform);
const expectRoute = (instruction, requestClass, executionMode = requestClass === "claim" ? "rerun_upstream" : "local_patch") => {
  const result = route(instruction);
  assert.equal(result.requestClass, requestClass, instruction);
  assert.equal(result.executionMode, executionMode, instruction);
  return result;
};

const liveInstruction = "仅修改第1页、第3页、第5页、第6页、第7页卡片文字，其他页面不变。第1页标题改为‘AI数智官落地前，先看这3个问题’，正文改为‘企业资料、业务场景、协作流程’；第3页标题改为‘AI数智官不只是聊天工具’，正文改为‘面向企业AI应用落地，服务外贸工厂等客户’，并只引用支持这些表述的事实；第5页正文改为‘有可用资料吗？场景明确吗？协作顺畅吗？’；第6页正文改为‘盘点资料、明确场景、逐步落地’；第7页标题改为‘已确认的服务内容’，正文改为‘AI数智官、B2B独立站增长全案、海外社媒运营’，并只引用支持这些表述的事实。删除原有无来源的案例、百分比、询盘响应和转化表述，不新增输入之外的信息。";
const liveRoute = expectRoute(liveInstruction, "page_text");
assert.deepEqual(liveRoute.rerunPlan, ["renderer", "xhs_review"]);

expectRoute("删除第 7 页没有来源的客户案例，只保留已确认事实", "page_text");
expectRoute("压缩第5页现有事实表述，仅使用已有可核验事实", "page_text");
expectRoute("把第3页的无来源百分比移除", "page_text");
expectRoute("调整第 6 页标题和正文层级", "page_text");
expectRoute("修改 P5、P6 和 P7 的现有页面文案", "page_text");
expectRoute("修改第1、3、5、6、7页，只保留有来源内容", "page_text");

expectRoute("在第 5 页新增一个客户案例", "claim");
expectRoute("把第 5 页改成一个新案例", "claim");
expectRoute("给第 5 页补充转化率数据", "claim");
expectRoute("把第 5 页价格改为 99 元", "claim");
expectRoute("将第 6 页活动时间更新为明天", "claim");
expectRoute("在第 3 页加入新的产品能力", "claim");
expectRoute("把第 7 页替换成未经确认的新事实", "claim");
expectRoute("将 P5 的案例替换为某工厂提升 50% 的新结果", "claim");
expectRoute("第5页案例替换为某工厂提升 50%", "claim");
expectRoute("第5页替换为未经确认的新案例，即使其他内容只引用已确认事实", "claim");

expectRoute("第5页删除无来源案例，不新增案例", "page_text");
expectRoute("第5页删除旧数据，不要增加数据", "page_text");
expectRoute("第5页压缩现有表述，禁止补充新事实，只引用支持这些表述的事实", "page_text");
expectRoute("第5页不新增案例", "page_text");
expectRoute("第5页不要增加数据", "page_text");
expectRoute("第5页禁止补充新事实", "page_text");
expectRoute("第5页新增案例", "claim");
expectRoute("第5页增加数据", "claim");
expectRoute("第5页补充新事实", "claim");

expectRoute("删除没有来源的案例", "claim");
expectRoute("调整现有事实并新增案例", "claim");
expectRoute("把价格修改为 199 元", "claim");
expectRoute("普通正文语气更克制", "copy");
expectRoute("只修改标题和正文开头，其余正文事实、引用和卡片内容保持不变", "copy");
expectRoute("文案调整，不改变已有事实和数据", "copy");
expectRoute("事实保持不变，但新增一个客户案例", "claim");

assert.equal(route("修改第 2 页现有文字", "wechat").requestClass, "copy", "公众号不得误用 XHS 页级路由");
assert.equal(route("更换第 2 页图片").requestClass, "image_spec", "图片路由优先级保持不变");
assert.equal(route("把内容目的改成案例展示").requestClass, "purpose", "内容目的路由优先级保持不变");

server.close();
const { database } = await import("../../storage.mjs");
database.close();
await rm(isolatedDataDir, { recursive: true, force: true });
console.log("xhs revision routing self-test passed", { cases: 38, liveRequestClass: liveRoute.requestClass });
