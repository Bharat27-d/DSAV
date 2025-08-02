import java.util.ArrayList;
import java.util.Scanner;

public class ArrayListDemo {
    public static void main(String[] args) {
        double StartTime=System.nanoTime();
        Scanner scanner = new Scanner(System.in);

        System.out.print("Enter the size of the ArrayList: ");
        int size = scanner.nextInt();

        ArrayList<Integer> list = new ArrayList<>();

        System.out.println("Enter " + size + " elements:");

        long startTime = System.nanoTime();

        for (int i = 0; i < size; i++) {
            System.out.print("Element " + (i + 1) + ": ");
            int element = scanner.nextInt();
            list.add(element);
        }

        System.out.println("The ArrayList is: " + list);

        System.out.print("Enter the position of the element to display (0 to " + (size - 1) + "): ");
        int pos = scanner.nextInt();

        if (pos >= 0 && pos < size) {
            System.out.println("Element at position " + pos + " is: " + list.get(pos));
        } else {
            System.out.println("Invalid position! Please enter a position between 0 and " + (size - 1));
        }

        long endTime = System.nanoTime();

        long elapsedTime = endTime - startTime;

        System.out.println("Execution time (nanoseconds): " + elapsedTime);

        scanner.close();
    double StopTime=System.nanoTime();
    System.out.println("Total execution Time"+(StopTime-StartTime));
    }
}