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
 * الملف سطر بسطر، وأي فرق بسيط في المسافات بين نسخة الملف عندك
 * ونسخة الملف اللي اتعمل عليها الـ patch بيخلي التطبيق يفشل. السكريبت
 * ده بيدور على نص مميز (anchor) في الملف بدل أرقام سطور، فهو مش
 * بيتأثر بفروقات المسافات أو الأسطر.
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
// 2) إضافة الدالة نفسها قبل قسم "USER CONSENT"
// ---------------------------------------------------------
const methodAnchor = "// USER CONSENT";
if (!content.includes(methodAnchor)) {
    fail(
        "مش لاقي علامة القسم المتوقعة:\n   " + methodAnchor +
        "\n   يبدو إن نسخة الملف مختلفة عن المتوقع."
    );
}

const newMethod =
`    // ---------------------------------------------------------
    // AD INSPECTOR
    // ---------------------------------------------------------
    // بيفتح شاشة "مُفتش الإعلانات" الرسمية من جوجل، اللي بتوري
    // السبب الحقيقي لكل طلب إعلان فشل (مش بس رقم كود زي 403).
    // initialize() لازم يتنادى قبلها عشان تقدر تشوف كل الوحدات
    // الإعلانية بتاعتك.
    @PluginMethod
    public void openAdInspector(final PluginCall call) {
        Activity activity = getActivity();
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
    }

    `;

// بندوّر على السطر اللي فيه علامة القسم عشان نحط الدالة قبل أول سطر
// من الكومنت بتاعه (بأقل مسافة بادئة ممكنة تسبقه في نفس السطر)
const sectionCommentLine = content
    .split("\n")
    .find((line) => line.includes(methodAnchor) && line.trim().startsWith("//"));

if (!sectionCommentLine) {
    fail("لقيت النص لكن مش في شكل سطر كومنت متوقع.");
}

// نلاقي أول سطر فاصل "// ----" قبل سطر الكومنت ده (لو موجود) عشان
// نحط الدالة الجديدة قبل بداية القسم بالكامل، مش نص فيه.
const lines = content.split("\n");
const commentIndex = lines.findIndex((line) => line.includes(methodAnchor) && line.trim().startsWith("//"));

let insertAt = commentIndex;
if (commentIndex > 0 && lines[commentIndex - 1].trim().startsWith("// ---")) {
    insertAt = commentIndex - 1;
}

lines.splice(insertAt, 0, newMethod.replace(/\n$/, ""));
content = lines.join("\n");

fs.writeFileSync(TARGET, content, "utf8");
console.log("✅ [patch-admob-ad-inspector] تمت إضافة openAdInspector بنجاح.");
