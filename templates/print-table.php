<style type="text/css">
    table {
        border-collapse: collapse;
    }

    td {
        border: solid #999 1px;
        font-size: 11px;
        padding: 5px;
    }
</style>

<table>
    <tr>
		<?php
		foreach ($columns as $column_id => $f) {
			if (!$f['print'])
				continue;
			?>
            <td style="font-weight: bold"><?= entities($f['label']) ?></td><?php
		}
		?>
    </tr>

	<?php
	foreach ($list as $id => $el) {
		?>
        <tr>
			<?php
			foreach ($columns as $column_id => $f) {
				if (!$f['print'])
					continue;

				$c = $el['columns'][$column_id];

				$cellBackground = $c['background'] ?: $el['background'];
				$cellColor = $c['color'] ?: $el['color'];
				?>
                <td style="<?= $cellBackground ? 'background: ' . entities($cellBackground) . ';' : '' ?><?= $cellColor ? 'color: ' . entities($cellColor) . ';' : '' ?>">
					<?php
					if ($f['price'] and is_numeric($c['text']))
						echo makePrice($c['text']);
					else
						echo $c['text'];
					?>
                </td>
				<?php
			}
			?>
        </tr>
		<?php
	}

	if (!empty($totals)) {
		$free_cells = 0;
		foreach ($columns as $column_id => $f) {
			if (!$f['print'])
				continue;
			if (isset($totals[$column_id]))
				break;
			$free_cells++;
		}

		?>
        <tr><?php
		if ($free_cells > 0)
			echo '<td colspan="' . $free_cells . '" style="text-align: right; font-weight: bold">Totali:</td>';

		$cc = 0;
		foreach ($columns as $column_id => $f) {
			if (!$f['print'])
				continue;
			$cc++;
			if ($cc <= $free_cells)
				continue;

			?>
            <td><?php
			if (isset($totals[$column_id])) {
				if ($f['price'])
					echo makePrice($totals[$column_id]);
				else
					echo $totals[$column_id];
			}
			?></td><?php
		}
		?></tr><?php
	}
	?>
</table>