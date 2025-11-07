from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('productos', '0001_initial'),
    ]

    operations = [
        migrations.RenameField(
            model_name='producto',
            old_name='necesita_receta',
            new_name='requiere_receta',
        ),
        migrations.AddField(
            model_name='producto',
            name='stock',
            field=models.PositiveIntegerField(default=0),
        ),
    ]
