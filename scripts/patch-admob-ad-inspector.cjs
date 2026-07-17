#!/usr/bin/env node
/**
 * postinstall script — بديل عن patch-package.
 *
 * بيضيف دالة native جديدة (openAdInspector) لملف الـ plugin بتاع
 * @capacitor-community/admob جوّه node_modules، عشان نقدر نفتح
 * "مُفتش الإعلانات" الرسمي من جوجل (MobileAds.openAdInspector) من
 * كود React مباشرة.
 *
 * ليه سكريبت بدل patch-package؟ لأن patch-package بيعتمد على تطابق
 * الملف سطر بسطر، وأي فرق بسيط بيخلي التطبيق يفشل. السكريبت ده بيدور
 * على نص كود حقيقي (مش كومنت) كـ "مرساة" — نص مش من المفروض يتغير
 * لأنه جزء من منطق الكود نفسه، فهو مش بيتأثر بفروقات المسافات أو
 * صياغة الكومنتات.
 *
 * السكريبت آمن يتنفذ أكتر من مرة (idempotent): لو الكود مضاف بالفعل
 * مش هيضيفه تاني.
 */

const fs = require("fs");
const path = require("path");

const TARGET = path.join(
    __dirname,
    "..",
    "node_modules",
    "@capacitor-community",
    "admob",
    "android",
    "src",
    "main",
    "java",
    "com",
    "getcapacitor",
    "community",
    "admob",
    "AdMob.java"
);

function fail(message) {
    console.error("\n❌ [patch-admob-ad-inspector] " + message);
    console.error(
        "   الملف المستهدف: " + TARGET + "\n" +
        "   لازم تتأكد إن الملف موجود (بعد npm install) وإنه بالشكل المتوقع.\n" +
        "   لو المشكلة استمرت، افتحي الملف يدويًا وضيفي الكود بنفسك (راجعي التعليمات).\n"
    );
    process.exit(1);
}

if (!fs.existsSync(TARGET)) {
    fail("الملف مش موجود. تأكدي إن @capacitor-community/admob اتثبت (npm install) قبل ما السكريبت ده يتنفذ.");
}

let content = fs.readFileSync(TARGET, "utf8");

// idempotent: لو الدالة مضافة بالفعل، منعملش حاجة
if (content.includes("openAdInspector")) {
    console.log("✅ [patch-admob-ad-inspector] openAdInspector موجودة بالفعل — مفيش حاجة نعملها.");
    process.exit(0);
}

// ---------------------------------------------------------
// 1) إضافة الـ imports
// ---------------------------------------------------------
const importAnchor = "import com.google.android.gms.ads.MobileAds;";
if (!content.includes(importAnchor)) {
    fail(
        "مش لاقي سطر الـ import المتوقع:\n   " + importAnchor +
        "\n   يبدو إن نسخة الملف مختلفة عن المتوقع."
    );
}

const newImports =
    "import com.google.android.gms.ads.AdInspectorError;\n" +
    importAnchor + "\n" +
    "import com.google.android.gms.ads.OnAdInspectorClosedListener;";

content = content.replace(importAnchor, newImports);

// ---------------------------------------------------------
// 2) إضافة الدالة نفسها
// ---------------------------------------------------------
// بنستخدم سطر كود حقيقي (مش كومنت) كمرساة، لأن نص الكومنتات ممكن
// يختلف شوية بين نسخة وتانية لكن الكود الوظيفي ده لازم يفضل ثابت.
const codeAnchor = "AuthorizationStatusEnum.AUTHORIZED.getStatus()";
const anchorIndex = content.indexOf(codeAnchor);

if (anchorIndex === -1) {
    fail(
        "مش لاقي سطر الكود المتوقع (مرساة الإدراج):\n   " + codeAnchor +
        "\n   يبدو إن نسخة الملف مختلفة عن المتوقع بشكل جوهري."
    );
}

// أول قوس "}" بعد المرساة ده نهاية الدالة اللي المرساة جواها
// (trackingAuthorizationStatus) — هنضيف الدالة الجديدة بعده مباشرة.
const closeBraceIndex = content.indexOf("}", anchorIndex);
if (closeBraceIndex === -1) {
    fail("لقيت مرساة الإدراج بس مش لاقي نهاية الدالة (قوس '}') بعدها.");
}

const insertionPoint = closeBraceIndex + 1; // بعد الـ "}" مباشرة

const newMethod =
`

    // ---------------------------------------------------------
    // AD INSPECTOR
    // ---------------------------------------------------------
    // بيفتح شاشة "مُفتش الإعلانات" الرسمية من جوجل، اللي بتوري
    // السبب الحقيقي لكل طلب إعلان فشل (مش بس رقم كود زي 403).
    // initialize() لازم يتنادى قبلها عشان تقدر تشوف كل الوحدات
    // الإعلانية بتاعتك.
    @PluginMethod
    public void openAdInspector(final PluginCall call) {
        android.app.Activity activity = getActivity();
        if (activity == null) {
            call.reject("Activity not available");
            return;
        }

        Runnable openOnMain = () -> {
            MobileAds.openAdInspector(
                activity,
                new OnAdInspectorClosedListener() {
                    @Override
                    public void onAdInspectorClosed(AdInspectorError error) {
                        JSObject ret = new JSObject();
                        if (error != null) {
                            ret.put("code", error.getCode());
                            ret.put("message", error.getMessage());
                        }
                        notifyListeners("adInspectorClosed", ret);
                    }
                }
            );
        };

        activity.runOnUiThread(openOnMain);
        call.resolve();
    }`;

content = content.slice(0, insertionPoint) + newMethod + content.slice(insertionPoint);

fs.writeFileSync(TARGET, content, "utf8");
console.log("✅ [patch-admob-ad-inspector] تمت إضافة openAdInspector بنجاح.");
