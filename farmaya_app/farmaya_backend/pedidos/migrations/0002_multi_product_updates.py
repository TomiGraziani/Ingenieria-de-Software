# Generated manually due to offline environment
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('pedidos', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='detallepedido',
            name='estado_receta',
            field=models.CharField(
                choices=[
                    ('no_requerida', 'No requiere'),
                    ('pendiente', 'Pendiente'),
                    ('aprobada', 'Aprobada'),
                    ('rechazada', 'Rechazada'),
                ],
                default='no_requerida',
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name='detallepedido',
            name='observaciones_receta',
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name='detallepedido',
            name='receta_archivo',
            field=models.FileField(blank=True, null=True, upload_to='recetas/'),
        ),
        migrations.AddField(
            model_name='detallepedido',
            name='requiere_receta',
            field=models.BooleanField(default=False),
        ),
        migrations.AlterField(
            model_name='pedido',
            name='estado',
            field=models.CharField(
                choices=[
                    ('pendiente', 'Pendiente'),
                    ('aceptado', 'Aceptado'),
                    ('rechazado', 'Rechazado'),
                    ('en_preparacion', 'En preparación'),
                    ('en_camino', 'En camino'),
                    ('entregado', 'Entregado'),
                    ('cancelado', 'Cancelado'),
                ],
                default='pendiente',
                max_length=50,
            ),
        ),
    ]
