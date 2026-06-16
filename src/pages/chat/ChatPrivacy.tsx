export default function ChatPrivacy() {
  return (
    <div className="p-6 max-w-2xl mx-auto" dir="rtl">
      <h1 className="font-horror text-3xl text-primary mb-4">سياسة الخصوصية — الدردشة</h1>

      <section className="space-y-4 text-sm font-typewriter text-foreground/90 leading-relaxed">
        <p><strong className="text-primary">ما الذي نخزّنه:</strong> اسم المستخدم، الصورة الاختيارية، رسائلك، تفاعلاتك، طلبات الصداقة، قائمة المحظورين، حالة التواجد (آخر ظهور)، والبلاغات التي تقدّمها.</p>

        <p><strong className="text-primary">عدم عرض البريد الإلكتروني:</strong> بريدك الإلكتروني <u>لا يظهر أبداً</u> لأي مستخدم آخر في أي مكان داخل التطبيق.</p>

        <p><strong className="text-primary">الرسائل تبقى داخل التطبيق:</strong> جميع رسائل الدردشة مخزّنة بشكل آمن في قاعدة بياناتنا (Supabase). لا نرسل أي رسائل دردشة عبر البريد الإلكتروني.</p>

        <p><strong className="text-primary">من يرى ماذا:</strong> فقط طرفا المحادثة يريان رسائلهما. لا يوجد مشرفون يقرؤون رسائلك إلا في حال تقديم بلاغ يتضمن تلك الرسالة.</p>

        <p><strong className="text-primary">من يستطيع البحث عنك:</strong> أي مستخدم أكمل 400 لغز يقدر يبحث عنك باسم المستخدم. المحظورون لا يرونك في البحث.</p>

        <p><strong className="text-primary">حقك في الحذف:</strong> يمكنك حذف حسابك في أي وقت من إعدادات التطبيق. سيؤدي ذلك لحذف رسائلك وملفك الشخصي بالكامل.</p>

        <p><strong className="text-primary">الإشراف الآلي:</strong> نستخدم نظام إشراف آلي يكتم/يوقف الحسابات المُبلَّغ عنها بشكل متكرر لحماية المجتمع.</p>

        <p><strong className="text-primary">البيانات المرسلة لجوجل بلاي:</strong> لا نشارك محتوى رسائلك مع أي طرف ثالث. تخزين البيانات يتم في خوادم Supabase المؤمَّنة.</p>
      </section>
    </div>
  );
}
