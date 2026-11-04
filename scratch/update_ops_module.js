const fs = require('fs');
const path = 'C:/Users/dogan/Documents/Private/Project/OdivonMainApi/src/modules/gym/ops/ops.module.ts';
let code = fs.readFileSync(path, 'utf8');

if (!code.includes("import { MailModule } from '../../../shared/mail/mail.module';")) {
  code = "import { MailModule } from '../../../shared/mail/mail.module';\n" + code;
  code = code.replace(
    'imports: [GymMembersModule, GymPackagesModule, GymAccessModule],',
    'imports: [GymMembersModule, GymPackagesModule, GymAccessModule, MailModule],'
  );
  fs.writeFileSync(path, code, 'utf8');
  console.log('ops.module.ts updated with MailModule!');
} else {
  console.log('Already updated!');
}

